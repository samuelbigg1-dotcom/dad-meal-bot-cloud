import "dotenv/config";
import crypto from "crypto";
import express from "express";
import fs from "fs/promises";
import path from "path";

import {
  addFood,
  deleteFood,
  deleteMeal,
  exportMealRows,
  getDailyTotals,
  getFoods,
  getMealItems,
  getMealsForDate,
  getRecommendationFoods,
  getUser,
  getWeeklyTotals,
  getWeights,
  initDb,
  saveMeal,
  saveWeight,
  setTargets,
  updateFoodFlags,
  upsertUser
} from "./db.js";
import { parseMealWithAI, explainRecommendationsWithAI } from "./ai.js";
import { calculateItems, totalItems } from "./nutrition.js";
import { generateRecommendations, remainingMacros } from "./recommendations.js";
import { addDays, b64JsonDecode, b64JsonEncode, csvEscape, escapeHtml, macroGoalsFromUser, round0, round1, todayInTimezone } from "./utils.js";
import { flash, layout, macroCards, mealList, totalsLine } from "./render.js";

const app = express();
const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || "America/Vancouver";
const USER_ID = process.env.APP_USER_ID || process.env.ALLOWED_TELEGRAM_USER_ID || "dad";
const WEB_PIN = process.env.WEB_PIN || "";
const COOKIE_SECRET = process.env.COOKIE_SECRET || WEB_PIN || "dev-secret-change-me";

app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use("/public", express.static("public", { maxAge: "1h" }));

function sign(value) {
  return crypto.createHmac("sha256", COOKIE_SECRET).update(value).digest("hex");
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(raw.split(";").map((part) => part.trim().split("=")).filter((p) => p.length === 2));
}

function isAuthed(req) {
  if (!WEB_PIN) return true;
  const cookies = parseCookies(req);
  const token = cookies.auth || "";
  return token === sign(WEB_PIN);
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.redirect("/login");
}

async function currentUser() {
  await upsertUser({ userId: USER_ID, firstName: "Dad", timezone: TIMEZONE });
  return getUser(USER_ID);
}

function postMealPayload({ parsedMeal, items, mealTotals, rawMessage, mealDate }) {
  return b64JsonEncode({ parsedMeal, items, mealTotals, rawMessage, mealDate });
}

app.get("/login", (req, res) => {
  if (!WEB_PIN) return res.redirect("/");
  res.send(layout({
    title: "Login",
    active: "",
    body: `<section class="card hero">
      <h2>Enter PIN</h2>
      <form method="post" action="/login" class="stack">
        <input class="input" name="pin" type="password" inputmode="numeric" placeholder="PIN" autofocus />
        <button class="button primary" type="submit">Open tracker</button>
      </form>
    </section>`
  }));
});

app.post("/login", (req, res) => {
  if (String(req.body.pin || "") === WEB_PIN) {
    res.setHeader("Set-Cookie", `auth=${sign(WEB_PIN)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
    return res.redirect("/");
  }
  res.redirect("/login");
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "auth=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  res.redirect("/login");
});

app.get("/", requireAuth, async (req, res) => {
  const user = await currentUser();
  const date = todayInTimezone(user.timezone || TIMEZONE);
  const totals = await getDailyTotals(USER_ID, date);
  const meals = await getMealsForDate(USER_ID, date);
  const weights = await getWeights(USER_ID, 1);

  res.send(layout({
    title: "Today",
    active: "dashboard",
    user,
    body: `
      <section class="hero card">
        <div>
          <div class="eyebrow">${escapeHtml(date)}</div>
          <h2>${round0(totals.calories)} / ${round0(user.calorie_goal)} calories</h2>
          <p>Use this screen to decide what to eat next, not just what already happened.</p>
        </div>
        <div class="action-row">
          <a class="button primary" href="/log">Log meal</a>
          <a class="button" href="/recommendations">Recommend next meal</a>
        </div>
      </section>

      ${macroCards(totals, user)}

      <section class="card">
        <div class="section-head">
          <h2>Meals today</h2>
          <a href="/history">History</a>
        </div>
        ${mealList(meals)}
      </section>

      <section class="card">
        <div class="section-head">
          <h2>Weight</h2>
          <span>${weights[0] ? `${Number(weights[0].weight_lb).toFixed(1)} lb` : "Not logged"}</span>
        </div>
        <form method="post" action="/weight" class="inline-form">
          <input class="input" name="weightLb" type="number" step="0.1" placeholder="170.4" />
          <button class="button" type="submit">Save weight</button>
        </form>
      </section>
    `
  }));
});

app.get("/log", requireAuth, async (req, res) => {
  const user = await currentUser();
  res.send(layout({
    title: "Log Meal",
    active: "log",
    user,
    body: `
      <section class="card hero">
        <h2>What did you eat today?</h2>
        <p>Choose the meal type, then type what was eaten. No need to write breakfast/dinner in the meal text.</p>
        <form method="post" action="/log/analyze" class="stack">
          <label class="field-label">Meal type</label>
          <div class="segmented" role="radiogroup" aria-label="Meal type">
            <label><input type="radio" name="mealType" value="breakfast" checked><span>Breakfast</span></label>
            <label><input type="radio" name="mealType" value="lunch"><span>Lunch</span></label>
            <label><input type="radio" name="mealType" value="dinner"><span>Dinner</span></label>
            <label><input type="radio" name="mealType" value="snack"><span>Snack</span></label>
            <label><input type="radio" name="mealType" value="late_breakfast"><span>Late breakfast</span></label>
          </div>
          <textarea class="textarea" name="mealText" rows="7" placeholder="Example: 12 oz pork tenderloin, 1 cup cooked rice, 1 cup broccoli"></textarea>
          <button class="button primary" type="submit">Analyze meal</button>
        </form>
      </section>
    `
  }));
});

app.post("/log/analyze", requireAuth, async (req, res) => {
  const user = await currentUser();
  const rawMessage = String(req.body.mealText || "").trim();
  const selectedMealType = String(req.body.mealType || "meal");
  if (!rawMessage) return res.redirect("/log");

  try {
    const date = todayInTimezone(user.timezone || TIMEZONE);
    const foods = await getFoods();
    const parsedMeal = await parseMealWithAI(rawMessage, selectedMealType);
    const items = calculateItems(parsedMeal, foods);
    const mealTotals = totalItems(items);
    parsedMeal.meal_type = selectedMealType;
    const payload = postMealPayload({ parsedMeal, items, mealTotals, rawMessage, mealDate: date });

    res.send(layout({
      title: "Confirm Meal",
      active: "log",
      user,
      body: `
        <section class="card">
          <h2>Confirm before saving</h2>
          <p class="muted">Meal type: <strong>${escapeHtml(selectedMealType.replace("_", " "))}</strong>. Check the items. If something looks wrong, go back and rewrite the meal.</p>
          <div class="list">
            ${items.map((item) => `<div class="list-row">
              <div>
                <strong>${escapeHtml(item.food_name)}</strong>
                <p>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} • ${escapeHtml(item.confidence)} confidence</p>
              </div>
              <div class="cal">${round0(item.calories)} cal</div>
            </div>`).join("")}
          </div>
          ${totalsLine(mealTotals)}
          <form method="post" action="/log/confirm" class="action-row">
            <input type="hidden" name="payload" value="${payload}" />
            <button class="button primary" type="submit">Save meal</button>
            <a class="button" href="/log">Edit text</a>
          </form>
        </section>
      `
    }));
  } catch (error) {
    res.send(layout({
      title: "Log Meal",
      active: "log",
      user,
      body: `${flash(`Could not analyze meal: ${error.message}`, "error")}<a class="button" href="/log">Try again</a>`
    }));
  }
});

app.post("/log/confirm", requireAuth, async (req, res) => {
  const user = await currentUser();
  const payload = b64JsonDecode(req.body.payload);
  await saveMeal({
    userId: USER_ID,
    mealDate: payload.mealDate || todayInTimezone(user.timezone || TIMEZONE),
    mealType: payload.parsedMeal.meal_type || "meal",
    rawMessage: payload.rawMessage,
    totals: payload.mealTotals,
    items: payload.items
  });
  res.redirect("/");
});

app.get("/recommendations", requireAuth, async (req, res) => {
  const user = await currentUser();
  const date = todayInTimezone(user.timezone || TIMEZONE);
  const totals = await getDailyTotals(USER_ID, date);
  const goals = macroGoalsFromUser(user);
  const remaining = remainingMacros(totals, goals);
  const foods = await getRecommendationFoods();

  const options = generateRecommendations({ totals, goals, foods, count: 4 });
  let aiExplanations = [];
  try {
    aiExplanations = await explainRecommendationsWithAI({ totals, goals, remaining, options: options.map((o) => ({ title: o.title, totals: o.totals, reason: o.reason })) });
  } catch (error) {
    aiExplanations = [];
  }

  res.send(layout({
    title: "Recommendations",
    active: "recommend",
    user,
    body: `
      <section class="card hero">
        <h2>Best next meals</h2>
        <p>Generated from the foods marked as available in the Foods page. The code scores the macros; AI only explains the fit.</p>
        ${totalsLine(remaining)}
      </section>

      ${options.length ? options.map((option, idx) => {
        const explanation = aiExplanations[idx]?.explanation || option.reason;
        const note = aiExplanations[idx]?.coaching_note || "";
        const payload = postMealPayload({
          parsedMeal: { meal_type: "meal", items: [] },
          items: option.items,
          mealTotals: option.totals,
          rawMessage: `Recommended meal: ${option.title}`,
          mealDate: date
        });

        return `<section class="card rec-card">
          <div class="section-head">
            <h2>Option ${idx + 1}</h2>
            <span class="score">Score ${round1(option.score)}</span>
          </div>
          <h3>${escapeHtml(aiExplanations[idx]?.title || option.title)}</h3>
          <div class="list compact">
            ${option.items.map((item) => `<div class="list-row">
              <div><strong>${escapeHtml(item.food_name)}</strong><p>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</p></div>
              <div class="cal">${round0(item.calories)} cal</div>
            </div>`).join("")}
          </div>
          ${totalsLine(option.totals)}
          <p>${escapeHtml(explanation)}</p>
          ${note ? `<p class="muted">${escapeHtml(note)}</p>` : ""}
          <form method="post" action="/log/confirm">
            <input type="hidden" name="payload" value="${payload}" />
            <button class="button primary" type="submit">Log this meal</button>
          </form>
        </section>`;
      }).join("") : `<section class="card">${flash("Add more available foods on the Foods page to generate recommendations.", "error")}</section>`}
    `
  }));
});

app.get("/foods", requireAuth, async (req, res) => {
  const user = await currentUser();
  const foods = await getFoods();

  res.send(layout({
    title: "Foods / Fridge",
    active: "foods",
    user,
    body: `
      <section class="card hero">
        <h2>Available foods</h2>
        <p>Recommendations use foods marked “Available at home” and “Use in recommendations.”</p>
      </section>

      <section class="card">
        <h2>Add food</h2>
        <form method="post" action="/foods" class="grid-form">
          <input class="input" name="name" placeholder="Name" required />
          <input class="input" name="baseQty" placeholder="Base qty" type="number" step="0.001" required />
          <input class="input" name="baseUnit" placeholder="Unit, e.g. oz/cup" required />
          <input class="input" name="calories" placeholder="Calories" type="number" step="0.1" required />
          <input class="input" name="protein" placeholder="Protein g" type="number" step="0.1" required />
          <input class="input" name="carbs" placeholder="Carbs g" type="number" step="0.1" required />
          <input class="input" name="fat" placeholder="Fat g" type="number" step="0.1" required />
          <input class="input" name="sugar" placeholder="Sugar g" type="number" step="0.1" required />
          <input class="input" name="fiber" placeholder="Fiber g" type="number" step="0.1" required />
          <input class="input" name="category" placeholder="Category: protein/carb/fat/vegetable/fruit" />
          <input class="input wide" name="aliases" placeholder="Aliases, comma separated" />
          <button class="button primary wide" type="submit">Save food</button>
        </form>
      </section>

      <section class="card">
        <h2>Saved foods</h2>
        <div class="food-list">
          ${foods.map((food) => `<div class="food-row">
            <div>
              <strong>${escapeHtml(food.name)}</strong>
              <p>${escapeHtml(food.base_qty)} ${escapeHtml(food.base_unit)} • ${round0(food.calories)} cal • P ${round1(food.protein_g)} C ${round1(food.carbs_g)} F ${round1(food.fat_g)} • ${escapeHtml(food.category || "uncategorized")}</p>
            </div>
            <div class="food-actions">
              <form method="post" action="/foods/${food.id}/toggle-pantry">
                <button class="chip ${food.is_pantry ? "on" : ""}" type="submit">${food.is_pantry ? "Available at home" : "Not available"}</button>
              </form>
              <form method="post" action="/foods/${food.id}/toggle-recommend">
                <button class="chip ${food.include_in_recommendations ? "on" : ""}" type="submit">${food.include_in_recommendations ? "Use in recommendations" : "Don’t recommend"}</button>
              </form>
          <form method="POST" action="/foods/${food.id}/remove-from-fridge" class="inline-form">
            <button class="btn btn-danger btn-small" type="submit">Remove from fridge</button>
          </form>
            </div>
          </div>`).join("")}
        </div>
      </section>
    `
  }));
});

app.post("/foods", requireAuth, async (req, res) => {
  await currentUser();
  await addFood({
    name: req.body.name,
    aliases: String(req.body.aliases || "").split(",").map((x) => x.trim()).filter(Boolean),
    base_qty: Number(req.body.baseQty),
    base_unit: req.body.baseUnit,
    calories: Number(req.body.calories),
    protein_g: Number(req.body.protein),
    carbs_g: Number(req.body.carbs),
    fat_g: Number(req.body.fat),
    sugar_g: Number(req.body.sugar),
    fiber_g: Number(req.body.fiber),
    category: req.body.category || "",
    is_pantry: true,
    include_in_recommendations: true
  });
  res.redirect("/foods");
});

app.post("/foods/:id/toggle-pantry", requireAuth, async (req, res) => {
  const foods = await getFoods();
  const food = foods.find((f) => Number(f.id) === Number(req.params.id));
  if (food) await updateFoodFlags(food.id, { isPantry: !food.is_pantry });
  res.redirect("/foods");
});

app.post("/foods/:id/toggle-recommend", requireAuth, async (req, res) => {
  const foods = await getFoods();
  const food = foods.find((f) => Number(f.id) === Number(req.params.id));
  if (food) await updateFoodFlags(food.id, { includeInRecommendations: !food.include_in_recommendations });
  res.redirect("/foods");
});

app.post("/foods/:id/remove-from-fridge", requireAuth, async (req, res) => {
  await updateFoodFlags(Number(req.params.id), {
    isPantry: false,
    includeInRecommendations: false
  });

  res.redirect("/foods");
});

app.get("/history", requireAuth, async (req, res) => {
  const user = await currentUser();
  const end = new Date();
  const start = addDays(end, -6);
  const startDate = todayInTimezone(user.timezone || TIMEZONE, start);
  const endDate = todayInTimezone(user.timezone || TIMEZONE, end);
  const rows = await getWeeklyTotals(USER_ID, startDate, endDate);
  const weights = await getWeights(USER_ID, 14);

  const avg = (key) => rows.length ? rows.reduce((s, r) => s + Number(r[key] || 0), 0) / rows.length : 0;

  res.send(layout({
    title: "History",
    active: "history",
    user,
    body: `
      <section class="card hero">
        <h2>Last 7 days</h2>
        <p>Averages are based only on days with logged meals.</p>
        <div class="totals-pill">
          <span>${round0(avg("calories"))} cal avg</span>
          <span>P ${round1(avg("protein_g"))}g</span>
          <span>C ${round1(avg("carbs_g"))}g</span>
          <span>F ${round1(avg("fat_g"))}g</span>
        </div>
      </section>

      <section class="card">
        <h2>Daily totals</h2>
        ${rows.length ? `<div class="list">${rows.map((r) => `<div class="list-row">
          <div><strong>${escapeHtml(r.meal_date)}</strong><p>P ${round1(r.protein_g)}g • C ${round1(r.carbs_g)}g • F ${round1(r.fat_g)}g</p></div>
          <div class="cal">${round0(r.calories)} cal</div>
        </div>`).join("")}</div>` : `<div class="empty">No history yet.</div>`}
      </section>

      <section class="card">
        <h2>Weights</h2>
        <form method="post" action="/weight" class="inline-form">
          <input class="input" name="weightLb" type="number" step="0.1" placeholder="170.4" />
          <button class="button" type="submit">Save today</button>
        </form>
        ${weights.length ? `<div class="list compact">${weights.map((w) => `<div class="list-row"><strong>${escapeHtml(w.date)}</strong><div>${Number(w.weight_lb).toFixed(1)} lb</div></div>`).join("")}</div>` : `<div class="empty">No weights logged yet.</div>`}
      </section>

      <section class="card">
        <h2>Export</h2>
        <a class="button" href="/export">Download meal CSV</a>
      </section>
    `
  }));
});

app.post("/weight", requireAuth, async (req, res) => {
  const user = await currentUser();
  const weightLb = Number(req.body.weightLb);
  if (Number.isFinite(weightLb)) {
    await saveWeight({ userId: USER_ID, date: todayInTimezone(user.timezone || TIMEZONE), weightLb });
  }
  res.redirect(req.headers.referer || "/");
});

app.get("/settings", requireAuth, async (req, res) => {
  const user = await currentUser();
  res.send(layout({
    title: "Settings",
    active: "settings",
    user,
    body: `
      <section class="card hero">
        <h2>Macro goals</h2>
        <p>Current recomp target can stay around 2600 calories unless trend data says otherwise.</p>
      </section>

      <section class="card">
        <form method="post" action="/settings" class="grid-form">
          <label>Calories<input class="input" name="calories" type="number" value="${escapeHtml(user.calorie_goal)}" /></label>
          <label>Protein g<input class="input" name="protein" type="number" value="${escapeHtml(user.protein_goal_g)}" /></label>
          <label>Carbs g<input class="input" name="carbs" type="number" value="${escapeHtml(user.carbs_goal_g)}" /></label>
          <label>Fat g<input class="input" name="fat" type="number" value="${escapeHtml(user.fat_goal_g)}" /></label>
          <label>Sugar g<input class="input" name="sugar" type="number" value="${escapeHtml(user.sugar_goal_g)}" /></label>
          <label>Fiber g<input class="input" name="fiber" type="number" value="${escapeHtml(user.fiber_goal_g)}" /></label>
          <button class="button primary wide" type="submit">Save goals</button>
        </form>
      </section>
    `
  }));
});

app.post("/settings", requireAuth, async (req, res) => {
  await currentUser();
  await setTargets(USER_ID, {
    calorie_goal: Number(req.body.calories),
    protein_goal_g: Number(req.body.protein),
    carbs_goal_g: Number(req.body.carbs),
    fat_goal_g: Number(req.body.fat),
    sugar_goal_g: Number(req.body.sugar),
    fiber_goal_g: Number(req.body.fiber)
  });
  res.redirect("/settings");
});

app.get("/export", requireAuth, async (req, res) => {
  await currentUser();
  const rows = await exportMealRows(USER_ID);
  const headers = ["date", "meal_type", "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "raw_message", "created_at"];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=meal-export.csv");
  res.send(csv);
});

async function main() {
  await initDb();
  await upsertUser({ userId: USER_ID, firstName: "Dad", timezone: TIMEZONE });

  app.listen(PORT, () => {
    console.log(`Dad Meal Web App running on port ${PORT}`);
    console.log(`Using APP_USER_ID=${USER_ID}`);
    if (!WEB_PIN) console.warn("WEB_PIN is not set. The web app is publicly accessible.");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
