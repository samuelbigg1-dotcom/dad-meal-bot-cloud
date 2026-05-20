import "dotenv/config";
import crypto from "crypto";
import express from "express";

import {
  addFood,
  deleteFood,
  deleteMeal,
  exportMealRows,
  getDailyTotals,
  getFoods,
  getMealById,
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
  updateMealWithItems,
  upsertUser
} from "./db.js";
import { parseMealWithAI, explainRecommendationsWithAI, scanNutritionLabelWithAI, scanBarcodeImageWithAI } from "./ai.js";
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

app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(express.json({ limit: "50mb" }));
app.use("/public", express.static("public", { maxAge: "0" }));

function sign(value) { return crypto.createHmac("sha256", COOKIE_SECRET).update(value).digest("hex"); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((p) => p.length === 2)); }
function isAuthed(req) { if (!WEB_PIN) return true; return (parseCookies(req).auth || "") === sign(WEB_PIN); }
function requireAuth(req, res, next) { if (isAuthed(req)) return next(); res.redirect("/login"); }
async function currentUser() { await upsertUser({ userId: USER_ID, firstName: "Dad", timezone: TIMEZONE }); return getUser(USER_ID); }
function postMealPayload({ parsedMeal, items, mealTotals, rawMessage, mealDate }) { return b64JsonEncode({ parsedMeal, items, mealTotals, rawMessage, mealDate }); }
function isDateString(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }
function confidencePercent(item) { const n = Number(item.confidence_percent || item.confidencePercent); if (Number.isFinite(n)) return Math.max(10, Math.min(100, Math.round(n))); if (item.confidence === "high") return 92; if (item.confidence === "low") return 45; return 65; }
function mealTypeLabel(value) { return String(value || "meal").replace("_", " "); }

async function analyzeMealText({ rawMessage, selectedMealType, mealDate }) {
  const foods = await getFoods();
  const parsedMeal = await parseMealWithAI(rawMessage, selectedMealType);
  const items = calculateItems(parsedMeal, foods);
  const mealTotals = totalItems(items);
  parsedMeal.meal_type = selectedMealType;
  return { parsedMeal, items, mealTotals, rawMessage, mealDate };
}

function confirmMealHtml({ selectedMealType, items, mealTotals, payload, action = "/log/confirm", editHref = "/log" }) {
  return `<section class="card">
    <h2>Confirm before saving</h2>
    <p class="muted">Meal type: <strong>${escapeHtml(mealTypeLabel(selectedMealType))}</strong>. Check the items. Low-confidence items need an extra check.</p>
    <div class="list">
      ${items.map((item) => {
        const score = confidencePercent(item);
        return `<div class="list-row" data-confidence-percent="${score}"><div><strong>${escapeHtml(item.food_name)}</strong><p>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} • ${score}% confidence${item.note ? ` • ${escapeHtml(item.note)}` : ""}</p></div><div class="cal">${round0(item.calories)} cal</div></div>`;
      }).join("")}
    </div>
    ${totalsLine(mealTotals)}
    <form method="post" action="${action}" class="action-row"><input type="hidden" name="payload" value="${payload}" /><button class="button primary" type="submit">Save meal</button><a class="button" href="${editHref}">Edit text</a></form>
  </section>`;
}

app.get("/login", (req, res) => {
  if (!WEB_PIN) return res.redirect("/");
  res.send(layout({ title: "Login", body: `<section class="card hero"><h2>Enter PIN</h2><form method="post" action="/login" class="stack"><input class="input" name="pin" type="password" inputmode="numeric" placeholder="PIN" autofocus /><button class="button primary" type="submit">Open tracker</button></form></section>` }));
});

app.post("/login", (req, res) => { if (String(req.body.pin || "") === WEB_PIN) { res.setHeader("Set-Cookie", `auth=${sign(WEB_PIN)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`); return res.redirect("/"); } res.redirect("/login"); });
app.get("/logout", (req, res) => { res.setHeader("Set-Cookie", "auth=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"); res.redirect("/login"); });

app.get("/", requireAuth, async (req, res) => {
  const user = await currentUser();
  const date = todayInTimezone(user.timezone || TIMEZONE);
  const totals = await getDailyTotals(USER_ID, date);
  const meals = await getMealsForDate(USER_ID, date);
  const weights = await getWeights(USER_ID, 1);
  res.send(layout({ title: "Today", active: "dashboard", user, body: `<section class="hero card"><div><div class="eyebrow">${escapeHtml(date)}</div><h2>${round0(totals.calories)} / ${round0(user.calorie_goal)} calories</h2><p>Use this screen to decide what to eat next, not just what already happened.</p></div><div class="action-row"><a class="button primary" href="/log">Log meal</a><a class="button" href="/recommendations">Recommend next meal</a></div></section>${macroCards(totals, user)}<section class="card"><div class="section-head"><h2>Meals today</h2><a href="/history">History</a></div>${mealList(meals)}</section><section class="card"><div class="section-head"><h2>Weight</h2><span>${weights[0] ? `${Number(weights[0].weight_lb).toFixed(1)} lb` : "Not logged"}</span></div><form method="post" action="/weight" class="inline-form"><input class="input" name="weightLb" type="number" step="0.1" placeholder="170.4" /><button class="button" type="submit">Save weight</button></form></section>` }));
});

app.get("/log", requireAuth, async (req, res) => {
  const user = await currentUser();
  res.send(layout({ title: "Log Meal", active: "log", user, body: `<section class="card hero"><h2>What did you eat today?</h2><p>Choose the meal type, then type what was eaten. No need to write breakfast/dinner in the meal text.</p><form method="post" action="/log/analyze" class="stack"><label class="field-label">Meal type</label><div class="segmented" role="radiogroup" aria-label="Meal type"><label><input type="radio" name="mealType" value="breakfast" checked><span>Breakfast</span></label><label><input type="radio" name="mealType" value="lunch"><span>Lunch</span></label><label><input type="radio" name="mealType" value="dinner"><span>Dinner</span></label><label><input type="radio" name="mealType" value="snack"><span>Snack</span></label><label><input type="radio" name="mealType" value="late_breakfast"><span>Late breakfast</span></label></div><textarea class="textarea" name="mealText" rows="7" placeholder="Example: 12 oz pork tenderloin, 1 cup cooked rice, 1 cup broccoli"></textarea><button class="button primary" type="submit">Analyze meal</button></form></section>` }));
});

app.post("/log/analyze", requireAuth, async (req, res) => {
  const user = await currentUser();
  const rawMessage = String(req.body.mealText || "").trim();
  const selectedMealType = String(req.body.mealType || "meal");
  if (!rawMessage) return res.redirect("/log");
  try {
    const date = todayInTimezone(user.timezone || TIMEZONE);
    const analyzed = await analyzeMealText({ rawMessage, selectedMealType, mealDate: date });
    const payload = postMealPayload(analyzed);
    res.send(layout({ title: "Confirm Meal", active: "log", user, body: confirmMealHtml({ selectedMealType, items: analyzed.items, mealTotals: analyzed.mealTotals, payload }) }));
  } catch (error) { res.send(layout({ title: "Log Meal", active: "log", user, body: `${flash(`Could not analyze meal: ${error.message}`, "error")}<a class="button" href="/log">Try again</a>` })); }
});

app.post("/log/confirm", requireAuth, async (req, res) => {
  const user = await currentUser();
  const payload = b64JsonDecode(req.body.payload);
  await saveMeal({ userId: USER_ID, mealDate: payload.mealDate || todayInTimezone(user.timezone || TIMEZONE), mealType: payload.parsedMeal.meal_type || "meal", rawMessage: payload.rawMessage, totals: payload.mealTotals, items: payload.items });
  res.redirect("/");
});

app.get("/meals/:id/edit", requireAuth, async (req, res) => {
  const user = await currentUser();
  const meal = await getMealById(USER_ID, Number(req.params.id));
  if (!meal) return res.redirect("/history");
  res.send(layout({ title: "Edit Meal", active: "history", user, body: `<section class="card hero"><h2>Edit meal</h2><p>Fix the text, meal type, or date, then re-analyze it.</p></section><section class="card"><form method="post" action="/meals/${meal.id}/edit" class="stack"><label class="field-label">Date</label><input class="input" type="date" name="mealDate" value="${escapeHtml(meal.meal_date)}" required /><label class="field-label">Meal type</label><div class="segmented" role="radiogroup" aria-label="Meal type">${["breakfast","lunch","dinner","snack","late_breakfast"].map((type) => `<label><input type="radio" name="mealType" value="${type}" ${meal.meal_type === type ? "checked" : ""}><span>${escapeHtml(mealTypeLabel(type))}</span></label>`).join("")}</div><textarea class="textarea" name="mealText" rows="6" required>${escapeHtml(meal.raw_message)}</textarea><div class="action-row"><button class="button primary" type="submit">Re-analyze meal</button><a class="button" href="/history?date=${escapeHtml(meal.meal_date)}">Cancel</a></div></form></section>` }));
});

app.post("/meals/:id/edit", requireAuth, async (req, res) => {
  const user = await currentUser();
  const meal = await getMealById(USER_ID, Number(req.params.id));
  if (!meal) return res.redirect("/history");
  const rawMessage = String(req.body.mealText || "").trim();
  const selectedMealType = String(req.body.mealType || meal.meal_type || "meal");
  const mealDate = isDateString(req.body.mealDate) ? String(req.body.mealDate) : meal.meal_date;
  if (!rawMessage) return res.redirect(`/meals/${meal.id}/edit`);
  try {
    const analyzed = await analyzeMealText({ rawMessage, selectedMealType, mealDate });
    await updateMealWithItems({ mealId: meal.id, userId: USER_ID, mealDate, mealType: analyzed.parsedMeal.meal_type || selectedMealType, rawMessage, totals: analyzed.mealTotals, items: analyzed.items });
    res.redirect(`/history?date=${mealDate}`);
  } catch (error) {
    res.send(layout({ title: "Edit Meal", active: "history", user, body: `${flash(`Could not re-analyze meal: ${error.message}`, "error")}<a class="button" href="/meals/${meal.id}/edit">Try again</a>` }));
  }
});

app.post("/meals/:id/delete", requireAuth, async (req, res) => {
  const meal = await getMealById(USER_ID, Number(req.params.id));
  await deleteMeal(Number(req.params.id), USER_ID);
  res.redirect(meal?.meal_date ? `/history?date=${meal.meal_date}` : "/history");
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
  try { aiExplanations = await explainRecommendationsWithAI({ totals, goals, remaining, options: options.map((o) => ({ title: o.title, totals: o.totals, reason: o.reason })) }); } catch (error) { aiExplanations = []; }
  res.send(layout({ title: "Recommendations", active: "recommend", user, body: `<section class="card hero"><h2>Best next meals</h2><p>Generated from the foods marked as available in the Foods page. The code scores the macros; AI only explains the fit.</p>${totalsLine(remaining)}</section>${options.length ? options.map((option, idx) => { const explanation = aiExplanations[idx]?.explanation || option.reason; const note = aiExplanations[idx]?.coaching_note || ""; const payload = postMealPayload({ parsedMeal: { meal_type: "meal", items: [] }, items: option.items, mealTotals: option.totals, rawMessage: `Recommended meal: ${option.title}`, mealDate: date }); return `<section class="card rec-card"><div class="section-head"><h2>Option ${idx + 1}</h2><span class="score">Score ${round1(option.score)}</span></div><h3>${escapeHtml(aiExplanations[idx]?.title || option.title)}</h3><div class="list compact">${option.items.map((item) => `<div class="list-row"><div><strong>${escapeHtml(item.food_name)}</strong><p>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</p></div><div class="cal">${round0(item.calories)} cal</div></div>`).join("")}</div>${totalsLine(option.totals)}<p>${escapeHtml(explanation)}</p>${note ? `<p class="muted">${escapeHtml(note)}</p>` : ""}<form method="post" action="/log/confirm"><input type="hidden" name="payload" value="${payload}" /><button class="button primary" type="submit">Log this meal</button></form></section>`; }).join("") : `<section class="card">${flash("Add more available foods on the Foods page to generate recommendations.", "error")}</section>`}` }));
});

app.get("/foods", requireAuth, async (req, res) => {
  const user = await currentUser();
  const foods = await getFoods();
  res.send(layout({ title: "Foods / Fridge", active: "foods", user, body: `<section class="card hero"><h2>Available foods</h2><p>Recommendations use foods marked “Available at home” and “Use in recommendations.”</p></section><section class="card"><h2>1. Scan Nutrition Facts label</h2><p class="muted">Take or upload a clear photo of the Nutrition Facts label.</p><form id="labelScanForm" class="grid-form"><input class="input wide" id="labelImageInput" type="file" accept="image/*" capture="environment" required /><button class="button primary wide" type="submit">Scan nutrition label</button></form><p class="muted" id="labelScanStatus"></p></section><section class="card"><h2>2. Scan barcode</h2><p class="muted">Take or upload a clear photo of the barcode. The app will read the barcode number and look up the packaged food.</p><form id="barcodeImageScanForm" class="grid-form"><input class="input wide" id="barcodeImageInput" type="file" accept="image/*" capture="environment" required /><button class="button primary wide" type="submit">Scan barcode photo</button></form><p class="muted" id="barcodeImageScanStatus"></p><hr class="soft-divider" /><p class="muted">Or type the barcode number manually.</p><form method="post" action="/foods/barcode" class="grid-form" id="barcodeLookupForm"><input class="input wide" id="barcodeInput" name="barcode" placeholder="Barcode / UPC number" required /><button class="button primary wide" type="submit">Look up barcode</button></form></section><section class="card"><h2>3. Add food manually</h2><form method="post" action="/foods" class="grid-form"><input class="input" name="name" placeholder="Name" required /><input class="input" name="baseQty" placeholder="Base qty" type="number" step="0.001" required /><input class="input" name="baseUnit" placeholder="Unit, e.g. oz/cup" required /><input class="input" name="calories" placeholder="Calories" type="number" step="0.1" required /><input class="input" name="protein" placeholder="Protein g" type="number" step="0.1" required /><input class="input" name="carbs" placeholder="Carbs g" type="number" step="0.1" required /><input class="input" name="fat" placeholder="Fat g" type="number" step="0.1" required /><input class="input" name="sugar" placeholder="Sugar g" type="number" step="0.1" required /><input class="input" name="fiber" placeholder="Fiber g" type="number" step="0.1" required /><input class="input" name="category" placeholder="Category: protein/carb/fat/vegetable/fruit" /><input class="input wide" name="aliases" placeholder="Aliases, comma separated" /><button class="button primary wide" type="submit">Save food</button></form></section><section class="card"><h2>Saved foods</h2><div class="food-list">${foods.map((food) => `<div class="food-row"><div><strong>${escapeHtml(food.name)}</strong><p>${escapeHtml(food.base_qty)} ${escapeHtml(food.base_unit)} • ${round0(food.calories)} cal • P ${round1(food.protein_g)} C ${round1(food.carbs_g)} F ${round1(food.fat_g)} • ${escapeHtml(food.category || "uncategorized")}</p></div><div class="food-actions"><form method="post" action="/foods/${food.id}/toggle-pantry"><button class="chip ${food.is_pantry ? "on" : "off"}" type="submit">${food.is_pantry ? "Available at home" : "Add to fridge"}</button></form><form method="post" action="/foods/${food.id}/toggle-recommend"><button class="chip ${food.include_in_recommendations ? "on" : "off"}" type="submit">${food.include_in_recommendations ? "Using in recommendations" : "Not currently recommending"}</button></form><form method="POST" action="/foods/${food.id}/delete" class="inline-form" onsubmit="return confirm('Delete this food completely? This cannot be undone.');"><button class="btn btn-danger btn-small" type="submit">Delete food</button></form></div></div>`).join("")}</div></section>` }));
});

app.post("/foods", requireAuth, async (req, res) => { await currentUser(); await addFood({ name: req.body.name, aliases: String(req.body.aliases || "").split(",").map((x) => x.trim()).filter(Boolean), base_qty: Number(req.body.baseQty), base_unit: req.body.baseUnit, calories: Number(req.body.calories), protein_g: Number(req.body.protein), carbs_g: Number(req.body.carbs), fat_g: Number(req.body.fat), sugar_g: Number(req.body.sugar), fiber_g: Number(req.body.fiber), category: req.body.category || "", is_pantry: true, include_in_recommendations: true }); res.redirect("/foods"); });

app.post("/foods/barcode", requireAuth, async (req, res) => {
  const user = await currentUser();
  const barcode = String(req.body.barcode || "").replace(/\D/g, "");
  if (!barcode) return res.redirect("/foods");
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,serving_size,nutriments,categories_tags`);
    const data = await response.json();
    if (!data || data.status !== 1 || !data.product) return res.send(layout({ title: "Barcode not found", active: "foods", user, body: `<section class="card hero"><h2>Barcode not found</h2><p>I could not find that barcode. You can still add it manually from the nutrition label.</p><a class="button primary" href="/foods">Back to foods</a></section>` }));
    const product = data.product; const nutriments = product.nutriments || {};
    const food = { name: product.product_name || product.brands || `Barcode ${barcode}`, baseQty: 1, baseUnit: product.serving_size || "serving", calories: Number(nutriments["energy-kcal_serving"] ?? nutriments["energy-kcal_100g"] ?? 0), protein: Number(nutriments["proteins_serving"] ?? nutriments["proteins_100g"] ?? 0), carbs: Number(nutriments["carbohydrates_serving"] ?? nutriments["carbohydrates_100g"] ?? 0), fat: Number(nutriments["fat_serving"] ?? nutriments["fat_100g"] ?? 0), sugar: Number(nutriments["sugars_serving"] ?? nutriments["sugars_100g"] ?? 0), fiber: Number(nutriments["fiber_serving"] ?? nutriments["fiber_100g"] ?? 0), category: "packaged", aliases: [barcode, product.brands].filter(Boolean).join(", ") };
    const encoded = b64JsonEncode(food);
    res.send(layout({ title: "Confirm packaged food", active: "foods", user, body: `<section class="card hero"><h2>Confirm packaged food</h2><p>Check this before saving. Barcode databases are useful, but not always perfect.</p></section><section class="card"><form id="confirm-package-form" method="post" action="/foods/confirm-package" class="stack"><input type="hidden" name="food" value="${encoded}" /><label class="field-label">Food name</label><input class="input wide" name="customName" value="${escapeHtml(food.name)}" placeholder="Enter food name" required /><p>${escapeHtml(food.baseQty)} ${escapeHtml(food.baseUnit)}</p><div class="pill-row"><span class="pill">${round0(food.calories)} cal</span><span class="pill">P ${round1(food.protein)}g</span><span class="pill">C ${round1(food.carbs)}g</span><span class="pill">F ${round1(food.fat)}g</span><span class="pill">Sug ${round1(food.sugar)}g</span><span class="pill">Fib ${round1(food.fiber)}g</span></div><div class="action-row"><button class="button primary" type="submit">Save to fridge</button><a class="button secondary" href="/foods">Cancel</a></div></form></section>` }));
  } catch (error) { console.error(error); res.send(layout({ title: "Barcode lookup failed", active: "foods", user, body: `<section class="card hero"><h2>Barcode lookup failed</h2><p>${escapeHtml(error.message)}</p><a class="button primary" href="/foods">Back to foods</a></section>` })); }
});

app.post("/foods/label-scan", requireAuth, async (req, res) => { const imageDataUrl = String(req.body.imageDataUrl || ""); if (!imageDataUrl.startsWith("data:image/")) return res.status(400).json({ error: "Missing image. Upload a photo of the Nutrition Facts label." }); try { const food = await scanNutritionLabelWithAI(imageDataUrl); res.json({ food: { name: food.name || "Scanned packaged food", baseQty: Number(food.baseQty || 1), baseUnit: food.baseUnit || "serving", calories: Number(food.calories || 0), protein: Number(food.protein || 0), carbs: Number(food.carbs || 0), fat: Number(food.fat || 0), sugar: Number(food.sugar || 0), fiber: Number(food.fiber || 0), category: "packaged", aliases: "" } }); } catch (error) { console.error(error); res.status(500).json({ error: error.message || "Could not scan nutrition label." }); } });
app.post("/foods/barcode-image-scan", requireAuth, async (req, res) => { const imageDataUrl = String(req.body.imageDataUrl || ""); if (!imageDataUrl.startsWith("data:image/")) return res.status(400).json({ error: "Missing image. Upload a clear photo of the barcode." }); try { const barcode = await scanBarcodeImageWithAI(imageDataUrl); if (!barcode) return res.status(400).json({ error: "Could not read a barcode from that image." }); res.json({ barcode }); } catch (error) { console.error(error); res.status(500).json({ error: error.message || "Could not scan barcode image." }); } });
app.post("/foods/confirm-scanned-label", requireAuth, async (req, res) => { const user = await currentUser(); const food = b64JsonDecode(req.body.food); const encoded = b64JsonEncode(food); res.send(layout({ title: "Confirm scanned food", active: "foods", user, body: `<section class="card hero"><h2>Confirm scanned food</h2><p>Name it clearly before saving. Example: Milk 4L, Fairlife Chocolate Milk, Greek Yogurt, etc.</p></section><section class="card"><form id="confirm-package-form" method="post" action="/foods/confirm-package" class="stack"><input type="hidden" name="food" value="${encoded}" /><label class="field-label">Food name</label><input class="input wide" name="customName" value="${escapeHtml(food.name || "Scanned packaged food")}" placeholder="Example: Milk 4L" required /><p>${escapeHtml(food.baseQty || 1)} ${escapeHtml(food.baseUnit || "serving")}</p><div class="pill-row"><span class="pill">${round0(food.calories || 0)} cal</span><span class="pill">P ${round1(food.protein || 0)}g</span><span class="pill">C ${round1(food.carbs || 0)}g</span><span class="pill">F ${round1(food.fat || 0)}g</span><span class="pill">Sug ${round1(food.sugar || 0)}g</span><span class="pill">Fib ${round1(food.fiber || 0)}g</span></div><p class="muted">Scanned foods are saved as available, but not used in recommendations unless you turn that on later.</p><div class="action-row"><button class="button primary" type="submit">Save to fridge</button><a class="button secondary" href="/foods">Cancel</a></div></form></section>` })); });
app.post("/foods/confirm-package", requireAuth, async (req, res) => { const food = b64JsonDecode(req.body.food); const customName = String(req.body.customName || "").trim(); await addFood({ name: customName || food.name || "Packaged food", aliases: String(food.aliases || "").split(",").map((x) => x.trim()).filter(Boolean), base_qty: Number(food.baseQty || 1), base_unit: food.baseUnit || "serving", calories: Number(food.calories || 0), protein_g: Number(food.protein || 0), carbs_g: Number(food.carbs || 0), fat_g: Number(food.fat || 0), sugar_g: Number(food.sugar || 0), fiber_g: Number(food.fiber || 0), category: food.category || "packaged", is_pantry: true, include_in_recommendations: false }); res.redirect("/foods"); });
app.post("/foods/:id/toggle-pantry", requireAuth, async (req, res) => { const foods = await getFoods(); const food = foods.find((f) => Number(f.id) === Number(req.params.id)); if (food) await updateFoodFlags(food.id, { isPantry: !food.is_pantry }); res.redirect("/foods"); });
app.post("/foods/:id/toggle-recommend", requireAuth, async (req, res) => { const foods = await getFoods(); const food = foods.find((f) => Number(f.id) === Number(req.params.id)); if (food) await updateFoodFlags(food.id, { includeInRecommendations: !food.include_in_recommendations }); res.redirect("/foods"); });
app.post("/foods/:id/delete", requireAuth, async (req, res) => { await deleteFood(Number(req.params.id)); res.redirect("/foods"); });

app.get("/history", requireAuth, async (req, res) => {
  const user = await currentUser();
  const end = new Date();
  const start = addDays(end, -6);
  const startDate = todayInTimezone(user.timezone || TIMEZONE, start);
  const endDate = todayInTimezone(user.timezone || TIMEZONE, end);
  const rows = await getWeeklyTotals(USER_ID, startDate, endDate);
  const weights = await getWeights(USER_ID, 14);
  const selectedDate = isDateString(req.query.date) ? String(req.query.date) : "";
  const selectedMeals = selectedDate ? await getMealsForDate(USER_ID, selectedDate) : [];
  const selectedMealRows = selectedDate ? await Promise.all(selectedMeals.map(async (meal) => ({ meal, items: await getMealItems(meal.id) }))) : [];
  const selectedTotals = selectedDate ? await getDailyTotals(USER_ID, selectedDate) : null;
  const avg = (key) => rows.length ? rows.reduce((s, r) => s + Number(r[key] || 0), 0) / rows.length : 0;
  const selectedSection = selectedDate ? `<section class="card selected-day-card"><div class="section-head"><h2>${escapeHtml(selectedDate)}</h2><a href="/history">Back</a></div>${selectedTotals ? totalsLine(selectedTotals) : ""}${selectedMealRows.length ? `<div class="list">${selectedMealRows.map(({ meal, items }) => `<div class="list-row day-meal-row"><div><strong>${escapeHtml(meal.meal_type || "meal")}</strong><p>${escapeHtml(meal.raw_message || "")}</p>${items.length ? `<div class="pill-row mini">${items.map((item) => `<span class="pill">${escapeHtml(item.food_name)} • ${round0(item.calories)} cal • ${round0(item.confidence_percent || confidencePercent(item))}%</span>`).join("")}</div>` : ""}<div class="action-row mini-actions"><a class="button" href="/meals/${meal.id}/edit">Edit</a><form method="post" action="/meals/${meal.id}/delete" onsubmit="return confirm('Delete this meal?');"><button class="button danger" type="submit">Delete</button></form></div></div><div class="cal">${round0(meal.calories)} cal</div></div>`).join("")}</div>` : `<div class="empty">No meals logged for this day.</div>`}</section>` : "";
  res.send(layout({ title: "History", active: "history", user, body: `${selectedSection}<section class="card hero"><h2>Last 7 days</h2><p>Averages are based only on days with logged meals.</p><div class="totals-pill"><span>${round0(avg("calories"))} cal avg</span><span>P ${round1(avg("protein_g"))}g</span><span>C ${round1(avg("carbs_g"))}g</span><span>F ${round1(avg("fat_g"))}g</span></div></section><section class="card"><h2>Daily totals</h2>${rows.length ? `<div class="list">${rows.map((r) => `<a class="list-row history-day-link" href="/history?date=${escapeHtml(r.meal_date)}"><div><strong>${escapeHtml(r.meal_date)}</strong><p>P ${round1(r.protein_g)}g • C ${round1(r.carbs_g)}g • F ${round1(r.fat_g)}g</p></div><div class="cal">${round0(r.calories)} cal</div></a>`).join("")}</div>` : `<div class="empty">No history yet.</div>`}</section><section class="card"><h2>Weights</h2><form method="post" action="/weight" class="inline-form"><input class="input" name="weightLb" type="number" step="0.1" placeholder="170.4" /><button class="button" type="submit">Save today</button></form>${weights.length ? `<div class="list compact">${weights.map((w) => `<div class="list-row"><strong>${escapeHtml(w.date)}</strong><div>${Number(w.weight_lb).toFixed(1)} lb</div></div>`).join("")}</div>` : `<div class="empty">No weights logged yet.</div>`}</section><section class="card"><h2>Export</h2><a class="button" href="/export">Download meal CSV</a></section>` }));
});

app.post("/weight", requireAuth, async (req, res) => { const user = await currentUser(); const weightLb = Number(req.body.weightLb); if (Number.isFinite(weightLb)) await saveWeight({ userId: USER_ID, date: todayInTimezone(user.timezone || TIMEZONE), weightLb }); res.redirect(req.headers.referer || "/"); });
app.get("/settings", requireAuth, async (req, res) => { const user = await currentUser(); res.send(layout({ title: "Settings", active: "settings", user, body: `<section class="card hero"><h2>Macro goals</h2><p>Current recomp target can stay around 2600 calories unless trend data says otherwise.</p></section><section class="card"><form method="post" action="/settings" class="grid-form"><label>Calories<input class="input" name="calories" type="number" value="${escapeHtml(user.calorie_goal)}" /></label><label>Protein g<input class="input" name="protein" type="number" value="${escapeHtml(user.protein_goal_g)}" /></label><label>Carbs g<input class="input" name="carbs" type="number" value="${escapeHtml(user.carbs_goal_g)}" /></label><label>Fat g<input class="input" name="fat" type="number" value="${escapeHtml(user.fat_goal_g)}" /></label><label>Sugar g<input class="input" name="sugar" type="number" value="${escapeHtml(user.sugar_goal_g)}" /></label><label>Fiber g<input class="input" name="fiber" type="number" value="${escapeHtml(user.fiber_goal_g)}" /></label><button class="button primary wide" type="submit">Save goals</button></form></section>` })); });
app.post("/settings", requireAuth, async (req, res) => { await currentUser(); await setTargets(USER_ID, { calorie_goal: Number(req.body.calories), protein_goal_g: Number(req.body.protein), carbs_goal_g: Number(req.body.carbs), fat_goal_g: Number(req.body.fat), sugar_goal_g: Number(req.body.sugar), fiber_goal_g: Number(req.body.fiber) }); res.redirect("/settings"); });
app.get("/export", requireAuth, async (req, res) => { await currentUser(); const rows = await exportMealRows(USER_ID); const headers = ["meal_id", "date", "meal_type", "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "raw_message", "created_at"]; const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n"); res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", "attachment; filename=meal-export.csv"); res.send(csv); });

async function main() { await initDb(); await upsertUser({ userId: USER_ID, firstName: "Dad", timezone: TIMEZONE }); app.listen(PORT, () => { console.log(`Dad Meal Web App running on port ${PORT}`); console.log(`Using APP_USER_ID=${USER_ID}`); if (!WEB_PIN) console.warn("WEB_PIN is not set. The web app is publicly accessible."); }); }
main().catch((error) => { console.error(error); process.exit(1); });
