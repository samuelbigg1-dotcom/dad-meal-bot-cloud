import { round0, round1 } from "./utils.js";

export function progress(value, goal) {
  const v = Number(value || 0);
  const g = Number(goal || 0);
  if (!g) return "";
  const pct = Math.round((v / g) * 100);
  return ` / ${round0(g)} (${pct}%)`;
}

export function remaining(value, goal, unit = "g") {
  const v = Number(value || 0);
  const g = Number(goal || 0);
  if (!g) return "";
  const left = g - v;
  const sign = left >= 0 ? "left" : "over";
  const amount = unit === "cal" ? round0(Math.abs(left)) : round1(Math.abs(left));
  return ` — ${amount}${unit === "cal" ? "" : unit} ${sign}`;
}

export function formatTotals(title, totals, user = null, showRemaining = false) {
  return [
    title,
    `Calories: ${round0(totals.calories)}${user ? progress(totals.calories, user.calorie_goal) : ""}${showRemaining && user ? remaining(totals.calories, user.calorie_goal, "cal") : ""}`,
    `Protein: ${round1(totals.protein_g)}g${user ? progress(totals.protein_g, user.protein_goal_g) : ""}${showRemaining && user ? remaining(totals.protein_g, user.protein_goal_g, "g") : ""}`,
    `Carbs: ${round1(totals.carbs_g)}g${user ? progress(totals.carbs_g, user.carbs_goal_g) : ""}${showRemaining && user ? remaining(totals.carbs_g, user.carbs_goal_g, "g") : ""}`,
    `Fat: ${round1(totals.fat_g)}g${user ? progress(totals.fat_g, user.fat_goal_g) : ""}${showRemaining && user ? remaining(totals.fat_g, user.fat_goal_g, "g") : ""}`,
    `Sugar: ${round1(totals.sugar_g)}g${user ? progress(totals.sugar_g, user.sugar_goal_g) : ""}${showRemaining && user ? remaining(totals.sugar_g, user.sugar_goal_g, "g") : ""}`,
    `Fiber: ${round1(totals.fiber_g)}g${user ? progress(totals.fiber_g, user.fiber_goal_g) : ""}${showRemaining && user ? remaining(totals.fiber_g, user.fiber_goal_g, "g") : ""}`
  ].join("\n");
}

export function formatLoggedMeal({ items, mealTotals, dailyTotals, user, edited = false }) {
  const itemLines = items.map((item) => {
    const flag = item.confidence === "high" ? "" : ` (${item.confidence} confidence)`;
    return `- ${item.quantity} ${item.unit} ${item.food_name}: ${round0(item.calories)} cal${flag}`;
  }).join("\n");

  return [
    edited ? "Updated last meal." : "Logged meal.",
    "",
    itemLines,
    "",
    formatTotals("Meal total:", mealTotals),
    "",
    formatTotals("Today total:", dailyTotals, user, true),
    "",
    edited ? "Edit saved." : "Use /delete_last if that was wrong, or /edit_last with the correction."
  ].join("\n");
}

export function helpMessage() {
  return [
    "Meal tracker commands:",
    "",
    "Just send a meal normally:",
    "smoothie",
    "dinner 12 oz pork tenderloin, 1 cup cooked rice, 1 cup broccoli",
    "",
    "/today - show today's totals and remaining macros",
    "/week - show last 7 days and averages",
    "/foods - show saved foods",
    "/delete_last - remove last logged meal",
    "/edit_last rice was 1.5 cups not 1 cup",
    "/weight 170.4 - log body weight",
    "/weights - show recent weights",
    "/export - export meals to CSV",
    "/settargets 2600 175 305 70 65 35",
    "calories protein carbs fat sugar fiber",
    "",
    "/addfood name | base qty | unit | cal | protein | carbs | fat | sugar | fiber | aliases",
    "Example:",
    "/addfood banana | 1 | medium | 105 | 1.3 | 27 | 0.4 | 14 | 3 | bananas"
  ].join("\n");
}
