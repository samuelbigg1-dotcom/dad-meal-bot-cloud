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
    "oz": "oz", "ounce": "oz", "ounces": "oz",
    "g": "g", "gram": "g", "grams": "g",
    "slice": "slice", "slices": "slice"
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
