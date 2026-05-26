import { getUser, query, saveWeight, setTargets } from "./db.js";
import { setRecommendedMeals } from "./recommendedMeals.js";
import { escapeHtml, round0, round1, todayInTimezone } from "./utils.js";

const TIMEZONE = process.env.TIMEZONE || "America/Vancouver";

function page({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <script>try{document.documentElement.dataset.theme=localStorage.getItem("dadMealTheme")||"light";}catch(e){document.documentElement.dataset.theme="light";}</script>
  <link rel="stylesheet" href="/public/app.css?v=onboarding-v1" />
  <link rel="stylesheet" href="/public/compact.css?v=onboarding-v1" />
  <style>
    body { min-height: 100vh; }
    .onboarding-shell { max-width: 760px; margin: 0 auto; padding: 18px 14px 34px; }
    .onboarding-top { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px; }
    .onboarding-top h1 { margin:0; font-size: clamp(32px, 9vw, 52px); letter-spacing:-.06em; }
    .progress-dots { display:flex; gap:7px; }
    .progress-dots span { width:9px; height:9px; border-radius:999px; background:var(--line); }
    .progress-dots span.on { background:var(--accent); }
    .wizard-card { border-radius:32px; padding:24px; }
    .wizard-card h2 { font-size: clamp(28px, 8vw, 44px); line-height:.98; letter-spacing:-.06em; margin:0 0 10px; }
    .wizard-card > p { color:var(--muted); font-size:16px; line-height:1.45; margin:0 0 18px; }
    .option-grid { display:grid; gap:10px; margin:16px 0; }
    .option-grid.two { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .option-card { position:relative; display:block; border:1px solid var(--line); border-radius:22px; background:var(--card2); padding:14px; cursor:pointer; }
    .option-card input { position:absolute; opacity:0; pointer-events:none; }
    .option-card strong { display:block; font-size:17px; letter-spacing:-.02em; margin-bottom:4px; }
    .option-card span { color:var(--muted); font-size:13px; line-height:1.35; display:block; }
    .option-card:has(input:checked) { border-color:rgba(216,123,85,.6); box-shadow:0 0 0 2px rgba(216,123,85,.12); background:color-mix(in srgb, var(--card2) 82%, rgba(216,123,85,.14)); }
    .wizard-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:16px 0; }
    .wizard-grid .wide { grid-column:1 / -1; }
    .result-card { display:grid; gap:9px; margin:16px 0; }
    .result-row { display:flex; justify-content:space-between; gap:12px; border:1px solid var(--line); border-radius:18px; padding:12px 14px; background:var(--card2); font-weight:900; }
    .result-row span { color:var(--muted); }
    .coach-note { border:1px solid rgba(216,123,85,.25); border-radius:22px; padding:14px; background:color-mix(in srgb, var(--card2) 84%, rgba(216,123,85,.12)); color:var(--muted); line-height:1.42; }
    @media (max-width: 620px) { .wizard-grid, .option-grid.two { grid-template-columns:1fr; } .wizard-card { padding:20px; } }
  </style>
</head>
<body class="compact-ui">
  <main class="onboarding-shell">${body}</main>
</body>
</html>`;
}

function dots(active) {
  return `<div class="progress-dots" aria-hidden="true">${[1,2,3,4,5,6].map((n) => `<span class="${n <= active ? "on" : ""}"></span>`).join("")}</div>`;
}

function option({ name, value, title, detail, checked = false }) {
  return `<label class="option-card"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} required><strong>${title}</strong><span>${detail}</span></label>`;
}

export async function ensureOnboardingSchema() {
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_type TEXT DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_pace TEXT DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS eating_pattern TEXT DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm NUMERIC;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS starting_weight_lb NUMERIC;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_age NUMERIC;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sex_for_formula TEXT DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_weight_lb NUMERIC;`);
  await query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS owner_user_id TEXT;`);
  await query(`UPDATE foods SET owner_user_id = 'legacy-dad' WHERE owner_user_id IS NULL AND LOWER(name) IN ('dad smoothie');`);
}

export async function needsOnboarding(userId) {
  await ensureOnboardingSchema();
  const user = await getUser(userId);
  return !user?.onboarding_complete;
}

export async function checkInDue(userId) {
  await ensureOnboardingSchema();
  const user = await getUser(userId);
  if (!user?.onboarding_complete) return false;
  if (!user.last_checkin_at) return true;
  const last = new Date(user.last_checkin_at).getTime();
  return Number.isFinite(last) && Date.now() - last > 1000 * 60 * 60 * 24 * 7;
}

function activityMultiplier(level) {
  return ({ sitting: 1.2, light: 1.375, active: 1.55, training: 1.65, very_active: 1.8 })[level] || 1.375;
}

function recommendedMealsForPattern(pattern) {
  if (pattern === "two_big") return ["breakfast", "dinner"];
  if (pattern === "three_meals") return ["breakfast", "lunch", "dinner"];
  if (pattern === "meals_snacks") return ["breakfast", "lunch", "dinner", "snack"];
  if (pattern === "high_protein") return ["breakfast", "lunch", "dinner", "snack"];
  return ["breakfast", "lunch", "dinner", "snack"];
}

export function calculateStartingTargets(input) {
  const age = Math.max(18, Math.min(90, Number(input.age || 35)));
  const weightLb = Math.max(80, Math.min(500, Number(input.weightLb || 180)));
  const feet = Number(input.heightFeet || 5);
  const inches = Number(input.heightInches || 10);
  const heightCm = Math.max(120, Math.min(230, ((feet * 12) + inches) * 2.54));
  const kg = weightLb / 2.20462;
  const sex = String(input.sex || "male");
  const base = (10 * kg) + (6.25 * heightCm) - (5 * age) + (sex === "female" ? -161 : 5);
  const tdee = base * activityMultiplier(input.activityLevel);
  const goal = String(input.goalType || "maintain");
  const pace = String(input.goalPace || "steady");
  const cutPct = pace === "easy" ? 0.10 : pace === "faster" ? 0.20 : 0.15;
  const gainPct = pace === "easy" ? 0.05 : pace === "faster" ? 0.15 : 0.10;
  let calories = tdee;
  if (goal === "lose_fat") calories = tdee * (1 - cutPct);
  if (goal === "build_muscle") calories = tdee * (1 + Math.min(gainPct, 0.10));
  if (goal === "gain_weight") calories = tdee * (1 + gainPct);
  calories = Math.round(Math.max(1500, Math.min(4500, calories)) / 25) * 25;

  const proteinFactor = goal === "lose_fat" ? 0.9 : goal === "build_muscle" || goal === "gain_weight" ? 0.85 : 0.75;
  const protein_goal_g = Math.round(Math.max(90, Math.min(260, weightLb * proteinFactor)));
  const fat_goal_g = Math.round(Math.max(weightLb * 0.3, (calories * 0.25) / 9));
  const proteinCalories = protein_goal_g * 4;
  const fatCalories = fat_goal_g * 9;
  const carbs_goal_g = Math.round(Math.max(80, (calories - proteinCalories - fatCalories) / 4));
  const fiber_goal_g = Math.round(Math.max(25, Math.min(45, calories / 1000 * 14)));
  const sugar_goal_g = Math.round(Math.max(40, Math.min(85, (calories * 0.10) / 4)));

  return {
    calorie_goal: calories,
    protein_goal_g,
    carbs_goal_g,
    fat_goal_g,
    sugar_goal_g,
    fiber_goal_g,
    heightCm,
    weightLb,
    age,
    sex
  };
}

function targetResult(targets) {
  return `<div class="result-card">
    <div class="result-row"><span>Calories</span><strong>${round0(targets.calorie_goal)}</strong></div>
    <div class="result-row"><span>Protein</span><strong>${round0(targets.protein_goal_g)}g</strong></div>
    <div class="result-row"><span>Carbs</span><strong>${round0(targets.carbs_goal_g)}g</strong></div>
    <div class="result-row"><span>Fat</span><strong>${round0(targets.fat_goal_g)}g</strong></div>
    <div class="result-row"><span>Fiber</span><strong>${round0(targets.fiber_goal_g)}g</strong></div>
    <div class="result-row"><span>Sugar</span><strong>under ${round0(targets.sugar_goal_g)}g</strong></div>
  </div>`;
}

export async function showOnboarding(req, res) {
  await ensureOnboardingSchema();
  res.send(page({ title: "Set up your targets", body: `<div class="onboarding-top"><div><div class="eyebrow">Daily Macro Coach</div><h1>Let’s set your targets</h1></div>${dots(1)}</div>
    <section class="card wizard-card"><h2>A few quick answers.</h2><p>No macro math needed. Pick the simple options that fit best and we’ll build your starting daily targets.</p>
    <form method="post" action="/onboarding" class="stack">
      <label class="field-label">What are you using this for?</label>
      <div class="option-grid two">
        ${option({ name: "goalType", value: "lose_fat", title: "Lose fat", detail: "Lower calories, higher protein, steady progress.", checked: true })}
        ${option({ name: "goalType", value: "build_muscle", title: "Build muscle", detail: "Enough food and protein to support training." })}
        ${option({ name: "goalType", value: "maintain", title: "Maintain", detail: "Keep weight steady and build consistency." })}
        ${option({ name: "goalType", value: "gain_weight", title: "Bulk up", detail: "Gain weight with a controlled calorie surplus." })}
        ${option({ name: "goalType", value: "track", title: "Just track food", detail: "Start simple and learn your eating patterns." })}
      </div>
      <label class="field-label">Your info</label>
      <div class="wizard-grid">
        <input class="input" name="age" type="number" min="18" max="90" placeholder="Age" required />
        <select class="input" name="sex" required><option value="male">Male</option><option value="female">Female</option></select>
        <input class="input" name="heightFeet" type="number" min="4" max="7" placeholder="Height ft" required />
        <input class="input" name="heightInches" type="number" min="0" max="11" placeholder="Height in" required />
        <input class="input wide" name="weightLb" type="number" min="80" max="500" step="0.1" placeholder="Current weight lb" required />
      </div>
      <label class="field-label">Activity level</label>
      <div class="option-grid">
        ${option({ name: "activityLevel", value: "sitting", title: "Mostly sitting", detail: "Desk, driving, light daily movement.", checked: true })}
        ${option({ name: "activityLevel", value: "light", title: "Lightly active", detail: "Some walking or light activity most days." })}
        ${option({ name: "activityLevel", value: "active", title: "Active job / regular walking", detail: "On your feet often or moving a lot." })}
        ${option({ name: "activityLevel", value: "training", title: "Training 3–5 days/week", detail: "Regular gym, sport, or structured workouts." })}
        ${option({ name: "activityLevel", value: "very_active", title: "Very active", detail: "Hard training or physical work most days." })}
      </div>
      <label class="field-label">Pace</label>
      <div class="option-grid two">
        ${option({ name: "goalPace", value: "easy", title: "Easy pace", detail: "More comfortable and easier to stick to." })}
        ${option({ name: "goalPace", value: "steady", title: "Steady pace", detail: "Balanced progress without overthinking.", checked: true })}
        ${option({ name: "goalPace", value: "faster", title: "Faster pace", detail: "More aggressive, but still kept reasonable." })}
      </div>
      <label class="field-label">How do you usually eat?</label>
      <div class="option-grid">
        ${option({ name: "eatingPattern", value: "two_big", title: "2 big meals", detail: "Meal ideas focus around fewer, larger meals." })}
        ${option({ name: "eatingPattern", value: "three_meals", title: "3 meals", detail: "Breakfast, lunch, and dinner." })}
        ${option({ name: "eatingPattern", value: "meals_snacks", title: "Meals + snacks", detail: "A flexible day with snacks included.", checked: true })}
        ${option({ name: "eatingPattern", value: "high_protein", title: "High protein simple meals", detail: "Simple meals built around protein first." })}
        ${option({ name: "eatingPattern", value: "not_sure", title: "I don’t know yet", detail: "Start balanced and adjust later." })}
      </div>
      <div class="coach-note">These are starting targets. We’ll use weekly check-ins to understand the trend and keep things realistic.</div>
      <button class="button primary wide" type="submit">Build my targets</button>
    </form></section>` }));
}

export async function saveOnboarding(req, res) {
  await ensureOnboardingSchema();
  const userId = req.user?.telegram_user_id;
  const targets = calculateStartingTargets(req.body);
  const date = todayInTimezone(TIMEZONE);
  await setTargets(userId, targets);
  await saveWeight({ userId, date, weightLb: targets.weightLb });
  await setRecommendedMeals(userId, recommendedMealsForPattern(req.body.eatingPattern));
  await query(`
    UPDATE users SET
      onboarding_complete = true,
      goal_type = $2,
      goal_pace = $3,
      activity_level = $4,
      eating_pattern = $5,
      height_cm = $6,
      starting_weight_lb = $7,
      birth_age = $8,
      sex_for_formula = $9,
      onboarded_at = now(),
      last_checkin_at = now(),
      last_checkin_weight_lb = $7
    WHERE telegram_user_id = $1
  `, [userId, req.body.goalType, req.body.goalPace, req.body.activityLevel, req.body.eatingPattern, targets.heightCm, targets.weightLb, targets.age, targets.sex]);
  res.send(page({ title: "Your starting targets", body: `<div class="onboarding-top"><div><div class="eyebrow">Daily Macro Coach</div><h1>You’re set up</h1></div>${dots(6)}</div><section class="card wizard-card"><h2>Your starting targets</h2><p>Use these for now. The app will ask for a weekly check-in so the plan can get smarter over time.</p>${targetResult(targets)}<div class="coach-note">Meal ideas will follow your eating style, and your fridge starts clean. Add foods as you actually use them.</div><a class="button primary wide" href="/">Start tracking</a></section>` }));
}

export async function showCheckIn(req, res) {
  await ensureOnboardingSchema();
  const user = await getUser(req.user?.telegram_user_id);
  res.send(page({ title: "Weekly check-in", body: `<div class="onboarding-top"><div><div class="eyebrow">Weekly check-in</div><h1>Quick check-in</h1></div>${dots(6)}</div><section class="card wizard-card"><h2>How’s the trend?</h2><p>Once a week is enough. Weight jumps around day to day, so this keeps it useful without making it annoying.</p><form method="post" action="/check-in" class="stack"><label class="field-label">Current weight</label><input class="input" name="weightLb" type="number" min="80" max="500" step="0.1" placeholder="${escapeHtml(user?.last_checkin_weight_lb || user?.starting_weight_lb || "")}" required /><label class="field-label">How did the target feel?</label><div class="option-grid"><label class="option-card"><input type="radio" name="feel" value="easy" checked><strong>Pretty easy</strong><span>I could follow it without much trouble.</span></label><label class="option-card"><input type="radio" name="feel" value="okay"><strong>Manageable</strong><span>Not perfect, but realistic enough.</span></label><label class="option-card"><input type="radio" name="feel" value="hard"><strong>Hard to follow</strong><span>Hunger, schedule, or food choices made it tough.</span></label></div><button class="button primary wide" type="submit">Save check-in</button><a class="button wide" href="/">Skip for now</a></form></section>` }));
}

export async function saveCheckIn(req, res) {
  await ensureOnboardingSchema();
  const userId = req.user?.telegram_user_id;
  const weightLb = Number(req.body.weightLb || 0);
  if (weightLb > 0) await saveWeight({ userId, date: todayInTimezone(TIMEZONE), weightLb });
  await query(`UPDATE users SET last_checkin_at = now(), last_checkin_weight_lb = $2 WHERE telegram_user_id = $1`, [userId, weightLb]);
  res.send(page({ title: "Check-in saved", body: `<div class="onboarding-top"><div><div class="eyebrow">Weekly check-in</div><h1>Saved</h1></div>${dots(6)}</div><section class="card wizard-card"><h2>Check-in saved</h2><p>Nice. We’ll use weekly trends here instead of reacting to every normal daily weight swing.</p><div class="coach-note">Next step: keep tracking normally. Once there are enough check-ins, this can suggest small target adjustments instead of guessing.</div><a class="button primary wide" href="/">Back to Today</a></section>` }));
}
