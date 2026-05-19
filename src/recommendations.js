import { scaledFoodItem, totalItems } from "./nutrition.js";
import { clamp, round0, round1 } from "./utils.js";

const MACROS = ["calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g"];

function toNum(v) {
  return Number(v || 0);
}

export function remainingMacros(totals, goals) {
  const out = {};
  for (const key of MACROS) out[key] = round1(toNum(goals[key]) - toNum(totals[key]));
  return out;
}

function pctAfter(totals, candidate, goals, key) {
  return (toNum(totals[key]) + toNum(candidate[key])) / Math.max(1, toNum(goals[key]));
}

function inferType(food) {
  if (food.category) return String(food.category).toLowerCase();
  const cal = Math.max(1, toNum(food.calories));
  const proteinCal = toNum(food.protein_g) * 4;
  const carbCal = toNum(food.carbs_g) * 4;
  const fatCal = toNum(food.fat_g) * 9;
  if (toNum(food.fiber_g) >= 2.5 && cal < 120) return "vegetable";
  if (proteinCal / cal > 0.35) return "protein";
  if (fatCal / cal > 0.45) return "fat";
  if (carbCal / cal > 0.45) return "carb";
  return "other";
}

function portionFactors(food) {
  const unit = String(food.base_unit || "").toLowerCase();
  const type = inferType(food);
  if (type === "protein" && unit === "oz") return [4, 6, 8, 10, 12];
  if (type === "protein" && unit === "egg") return [2, 3, 4];
  if (type === "carb" && ["cup", "medium", "slice"].includes(unit)) return [0.5, 1, 1.5, 2];
  if (type === "vegetable") return [1, 2, 3];
  if (type === "fat") return [0.5, 1];
  if (type === "fruit") return [0.5, 1];
  return [1];
}

function candidatePart(food, factor) {
  const item = scaledFoodItem(food, factor, {
    quantity: round1(toNum(food.base_qty) * factor),
    unit: food.base_unit,
    confidence: "high",
    note: "Recommendation candidate"
  });
  return item;
}

function sum(items) {
  return totalItems(items);
}

function titleFor(items) {
  return items.map((i) => {
    const qty = Number(i.quantity).toFixed(2).replace(/\.?0+$/, "");
    return `${qty} ${i.unit} ${i.food_name}`;
  }).join(" + ");
}

function scoreCandidate({ totals, goals, candidate }) {
  let score = 1000;

  const cals = candidate.calories;
  if (cals < 250) score -= 80;
  if (cals > 1100) score -= 120;

  const weights = {
    calories: 1.0,
    protein_g: 1.6,
    carbs_g: 0.85,
    fat_g: 1.2,
    sugar_g: 1.6,
    fiber_g: 0.9
  };

  for (const key of MACROS) {
    const before = toNum(totals[key]) / Math.max(1, toNum(goals[key]));
    const after = pctAfter(totals, candidate, goals, key);

    if (key === "sugar_g" || key === "fat_g") {
      if (before >= 0.75 && after > 1.0) score -= 300 * (after - 1.0) * weights[key];
      if (before >= 0.75 && candidate[key] > Math.max(8, goals[key] * 0.2)) score -= 80 * weights[key];
      score -= Math.abs(Math.min(after, 1.05) - 0.95) * 45 * weights[key];
    } else if (key === "fiber_g") {
      if (before < 0.85 && candidate[key] > 3) score += 60;
      if (after > 1.5) score -= 40;
      score -= Math.abs(Math.min(after, 1.1) - 1.0) * 40 * weights[key];
    } else {
      if (before < 0.8 && after > before) score += 45 * weights[key];
      if (after > 1.15) score -= 220 * (after - 1.15) * weights[key];
      score -= Math.abs(Math.min(after, 1.08) - 1.0) * 50 * weights[key];
    }
  }

  if (toNum(totals.protein_g) / goals.protein_g < 0.75 && candidate.protein_g < 25) score -= 150;
  if (toNum(totals.sugar_g) / goals.sugar_g > 0.75 && candidate.sugar_g > 10) score -= 180;
  if (toNum(totals.fat_g) / goals.fat_g > 0.75 && candidate.fat_g > 18) score -= 140;

  return round1(score);
}

function reasonFor(totals, goals, candidate) {
  const reasons = [];
  const p = (key) => toNum(totals[key]) / Math.max(1, toNum(goals[key]));
  if (p("protein_g") < 0.8) reasons.push("protein is still low");
  if (p("calories") < 0.8) reasons.push("calories are still low");
  if (p("fiber_g") < 0.8 && candidate.fiber_g >= 3) reasons.push("fiber needs help");
  if (p("sugar_g") > 0.7) reasons.push("keeps sugar controlled");
  if (p("fat_g") > 0.7) reasons.push("avoids pushing fat too high");
  return reasons.length ? `Picked because ${reasons.join(", ")}.` : "Picked because it keeps today's macros balanced.";
}

function classifyFoods(foods) {
  const recFoods = foods.filter((f) => f.include_in_recommendations !== false && f.is_pantry !== false);
  const groups = { protein: [], carb: [], vegetable: [], fruit: [], fat: [], other: [] };
  for (const food of recFoods) {
    const type = inferType(food);
    if (!groups[type]) groups.other.push(food);
    else groups[type].push(food);
  }
  return groups;
}

export function generateRecommendations({ totals, goals, foods, count = 5 }) {
  const groups = classifyFoods(foods);

  const proteins = groups.protein.length ? groups.protein : foods.filter((f) => toNum(f.protein_g) >= 5);
  const carbs = [...groups.carb, ...groups.fruit].length ? [...groups.carb, ...groups.fruit] : foods.filter((f) => toNum(f.carbs_g) >= 10);
  const vegetables = groups.vegetable.length ? groups.vegetable : foods.filter((f) => toNum(f.fiber_g) >= 2);
  const fats = groups.fat;

  const candidates = [];

  function pushCandidate(items) {
    const totalsForMeal = sum(items);
    if (totalsForMeal.calories < 150) return;
    if (totalsForMeal.calories > 1250) return;
    if (pctAfter(totals, totalsForMeal, goals, "sugar_g") > 1.25) return;
    if (pctAfter(totals, totalsForMeal, goals, "fat_g") > 1.25) return;
    if (pctAfter(totals, totalsForMeal, goals, "calories") > 1.18) return;

    const title = titleFor(items);
    const score = scoreCandidate({ totals, goals, candidate: totalsForMeal });
    candidates.push({
      title,
      items,
      totals: totalsForMeal,
      score,
      reason: reasonFor(totals, goals, totalsForMeal)
    });
  }

  for (const p of proteins.slice(0, 12)) {
    for (const pf of portionFactors(p)) {
      const pItem = candidatePart(p, pf);

      // Protein only / light option
      pushCandidate([pItem]);

      for (const c of carbs.slice(0, 12)) {
        for (const cf of portionFactors(c)) {
          const cItem = candidatePart(c, cf);
          pushCandidate([pItem, cItem]);

          for (const v of vegetables.slice(0, 8)) {
            for (const vf of portionFactors(v).slice(0, 2)) {
              const vItem = candidatePart(v, vf);
              pushCandidate([pItem, cItem, vItem]);

              if (toNum(totals.fat_g) / goals.fat_g < 0.65) {
                for (const f of fats.slice(0, 5)) {
                  for (const ff of portionFactors(f).slice(0, 1)) {
                    pushCandidate([pItem, cItem, vItem, candidatePart(f, ff)]);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const unique = [];
const seenExact = new Set();
const seenIngredientCombos = new Set();

for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
  // Exact duplicate check: same foods, quantities, and units.
  const exactKey = candidate.items
    .map((i) => `${String(i.food_name).toLowerCase()}:${i.quantity}:${i.unit}`)
    .sort()
    .join("|");

  // Meal-style duplicate check: same ingredients, even if quantities differ.
  // This prevents:
  // chicken + potato + broccoli
  // chicken + potato + broccoli
  // showing twice with slightly different portions.
  const ingredientComboKey = candidate.items
    .map((i) => String(i.food_name).toLowerCase().trim())
    .sort()
    .join("|");

  if (seenExact.has(exactKey)) continue;
  if (seenIngredientCombos.has(ingredientComboKey)) continue;

  seenExact.add(exactKey);
  seenIngredientCombos.add(ingredientComboKey);

  unique.push(candidate);
  if (unique.length >= count) break;
}

return unique;
}

export function macroStatus(totals, goals) {
  const status = {};
  for (const key of MACROS) {
    const pct = toNum(totals[key]) / Math.max(1, toNum(goals[key]));
    status[key] = {
      pct: round0(pct * 100),
      level: pct < 0.6 ? "low" : pct < 0.9 ? "on-track" : pct <= 1.05 ? "near" : "over"
    };
  }
  return status;
}
