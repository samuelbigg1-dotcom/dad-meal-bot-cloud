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
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
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

export function nextId(items) {
  const max = items.reduce((highest, item) => Math.max(highest, Number(item.id || 0)), 0);
  return max + 1;
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
