export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^\w\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalUnit(unit) {
  const u = normalizeText(unit);
  const map = {
    "cups": "cup", "c": "cup",
    "tbsp": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp", "tbs": "tbsp",
    "tsp": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
    "scoop": "scoop", "scoops": "scoop",
    "egg": "egg", "eggs": "egg",
    "medium": "medium", "med": "medium",
    "serving": "serving", "servings": "serving",
    "package": "package", "packages": "package", "packet": "package", "packets": "package",
    "bag": "bag", "bags": "bag",
    "oz": "oz", "ounce": "oz", "ounces": "oz",
    "g": "g", "gram": "g", "grams": "g",
    "slice": "slice", "slices": "slice",
    "muffin": "muffin", "muffins": "muffin"
  };
  return map[u] || u;
}

export function todayInTimezone(timezone = "America/Vancouver", date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

export function round0(value) {
  return Math.round(Number(value || 0));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function b64JsonEncode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function b64JsonDecode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

export function macroGoalsFromUser(user) {
  return {
    calories: Number(user?.calorie_goal || 2600),
    protein_g: Number(user?.protein_goal_g || 175),
    carbs_g: Number(user?.carbs_goal_g || 305),
    fat_g: Number(user?.fat_goal_g || 70),
    sugar_g: Number(user?.sugar_goal_g || 65),
    fiber_g: Number(user?.fiber_goal_g || 35)
  };
}

export function emptyTotals() {
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sugar_g: 0, fiber_g: 0 };
}

export function parseServingGrams(baseUnit) {
  const text = String(baseUnit || "").toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (!match) return null;

  const grams = Number(match[1]);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

export function normalizeBarcodeFoodServing(food) {
  const servingGrams = parseServingGrams(food?.baseUnit || food?.base_unit);
  if (!servingGrams || servingGrams >= 100) return { food, scaled: false };

  const calories = Number(food.calories || 0);
  const protein = Number(food.protein ?? food.protein_g ?? 0);
  const carbs = Number(food.carbs ?? food.carbs_g ?? 0);
  const fat = Number(food.fat ?? food.fat_g ?? 0);
  const sugar = Number(food.sugar ?? food.sugar_g ?? 0);
  const fiber = Number(food.fiber ?? food.fiber_g ?? 0);

  // If OpenFoodFacts gives only *_100g values, treating them as one serving can
  // produce impossible results. Example: 556 calories saved as a 45 g popcorn
  // serving. A real 45 g serving cannot exceed about 405 calories from macros.
  const impossibleCalories = calories > servingGrams * 9 + 20;
  const impossibleMacroWeight = protein + carbs + fat + sugar + fiber > servingGrams * 1.35;

  if (!impossibleCalories && !impossibleMacroWeight) return { food, scaled: false };

  const factor = servingGrams / 100;
  const scaledFood = {
    ...food,
    calories: round1(calories * factor),
    protein: round1(protein * factor),
    carbs: round1(carbs * factor),
    fat: round1(fat * factor),
    sugar: round1(sugar * factor),
    fiber: round1(fiber * factor)
  };

  if ("protein_g" in scaledFood) scaledFood.protein_g = scaledFood.protein;
  if ("carbs_g" in scaledFood) scaledFood.carbs_g = scaledFood.carbs;
  if ("fat_g" in scaledFood) scaledFood.fat_g = scaledFood.fat;
  if ("sugar_g" in scaledFood) scaledFood.sugar_g = scaledFood.sugar;
  if ("fiber_g" in scaledFood) scaledFood.fiber_g = scaledFood.fiber;

  return { food: scaledFood, scaled: true };
}
