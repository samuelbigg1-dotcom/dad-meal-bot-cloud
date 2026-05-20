import { execFileSync } from "child_process";
import { scaledFoodItem, totalItems } from "./nutrition.js";
import { round0, round1 } from "./utils.js";

const MACROS = ["calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g"];

function toNum(v) { return Number(v || 0); }
function nameOf(food) { return String(food.food_name || food.name || "").toLowerCase(); }
function hasAny(value, words) { return words.some((word) => value.includes(word)); }

export function remainingMacros(totals, goals) {
  const out = {};
  for (const key of MACROS) out[key] = round1(toNum(goals[key]) - toNum(totals[key]));
  return out;
}

function pctAfter(totals, candidate, goals, key) {
  return (toNum(totals[key]) + toNum(candidate[key])) / Math.max(1, toNum(goals[key]));
}

function inferType(food) {
  const category = String(food.category || "").toLowerCase();
  const name = nameOf(food);
  if (category) {
    if (category.includes("protein")) return "protein";
    if (category.includes("carb") || category.includes("grain") || category.includes("starch")) return "carb";
    if (category.includes("vegetable") || category.includes("veg")) return "vegetable";
    if (category.includes("fruit")) return "fruit";
    if (category.includes("fat") || category.includes("spread")) return "fat";
  }
  if (hasAny(name, ["chicken", "turkey", "beef", "steak", "salmon", "tuna", "egg", "eggs", "yogurt", "greek", "cottage cheese", "protein", "pork", "shrimp", "tofu"])) return "protein";
  if (hasAny(name, ["rice", "potato", "oat", "oats", "bread", "toast", "tortilla", "pasta", "noodle", "quinoa", "cereal", "bagel", "wrap", "bun"])) return "carb";
  if (hasAny(name, ["broccoli", "spinach", "lettuce", "salad", "pepper", "tomato", "cucumber", "carrot", "zucchini", "asparagus", "beans", "green", "vegetable", "veg"])) return "vegetable";
  if (hasAny(name, ["banana", "apple", "berries", "berry", "orange", "fruit", "grape", "mango", "pineapple"])) return "fruit";
  if (hasAny(name, ["peanut butter", "almond butter", "butter", "oil", "avocado", "nuts", "walnut", "almond", "mayo", "cheese", "cream cheese"])) return "fat";
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

function mealStyle(food) {
  const n = nameOf(food);
  const type = inferType(food);
  if (hasAny(n, ["salmon", "tuna", "shrimp", "fish"])) return "savory_seafood";
  if (hasAny(n, ["chicken", "turkey", "beef", "steak", "pork", "tofu"])) return "savory_plate";
  if (hasAny(n, ["egg", "eggs"])) return "breakfast";
  if (hasAny(n, ["yogurt", "cottage cheese", "smoothie", "protein powder"])) return "sweet_bowl";
  if (hasAny(n, ["peanut butter", "almond butter", "banana", "berries", "oats", "cereal", "granola"])) return "sweet_bowl";
  if (type === "vegetable") return "savory_plate";
  if (type === "fruit") return "sweet_bowl";
  return "neutral";
}

function isSweetFat(food) {
  return hasAny(nameOf(food), ["peanut butter", "almond butter", "nutella", "jam", "honey"]);
}

function isSavoryProtein(food) {
  return ["savory_seafood", "savory_plate"].includes(mealStyle(food));
}

function compatible(a, b) {
  if (!a || !b) return true;
  const an = nameOf(a);
  const bn = nameOf(b);
  const aType = inferType(a);
  const bType = inferType(b);
  if ((isSweetFat(a) && isSavoryProtein(b)) || (isSweetFat(b) && isSavoryProtein(a))) return false;
  if ((aType === "fruit" && isSavoryProtein(b)) || (bType === "fruit" && isSavoryProtein(a))) return false;
  if (aType === "protein" && bType === "protein") return false;
  if ((hasAny(an, ["salmon", "tuna", "fish", "shrimp"]) && hasAny(bn, ["yogurt", "cottage cheese", "milk"])) ||
      (hasAny(bn, ["salmon", "tuna", "fish", "shrimp"]) && hasAny(an, ["yogurt", "cottage cheese", "milk"]))) return false;
  return true;
}

function portionFactors(food) {
  const unit = String(food.base_unit || "").toLowerCase();
  const type = inferType(food);
  const n = nameOf(food);
  if (type === "protein" && unit === "oz") return [4, 6, 8];
  if (type === "protein" && unit === "egg") return [2, 3];
  if (type === "protein" && hasAny(n, ["yogurt", "cottage cheese"])) return [1];
  if (type === "carb" && ["cup", "medium", "slice"].includes(unit)) return [0.5, 1, 1.5];
  if (type === "vegetable") return [1, 2];
  if (type === "fat") return [0.5, 1];
  if (type === "fruit") return [0.5, 1];
  return [1];
}

function candidatePart(food, factor) {
  return scaledFoodItem(food, factor, {
    quantity: round1(toNum(food.base_qty) * factor),
    unit: food.base_unit,
    confidence: "high",
    confidence_percent: 92,
    note: "Recommendation candidate"
  });
}

function sum(items) { return totalItems(items); }

function titleFor(items) {
  const names = items.map((i) => i.food_name);
  const protein = items.find((i) => inferType(i) === "protein") || items[0];
  const carb = items.find((i) => inferType(i) === "carb");
  const veg = items.find((i) => inferType(i) === "vegetable");
  const fruit = items.find((i) => inferType(i) === "fruit");
  const fat = items.find((i) => inferType(i) === "fat");
  if (protein && hasAny(nameOf(protein), ["yogurt", "cottage cheese"])) return `${protein.food_name} bowl`;
  if (protein && hasAny(nameOf(protein), ["egg", "eggs"])) return carb ? `Eggs with ${carb.food_name}` : "Egg plate";
  if (protein && carb && veg) return `${protein.food_name} plate`;
  if (protein && carb) return `${protein.food_name} with ${carb.food_name}`;
  if (protein && veg) return `${protein.food_name} with ${veg.food_name}`;
  if (fruit && fat && !protein) return `${fruit.food_name} with ${fat.food_name}`;
  if (protein) return `${protein.food_name} snack`;
  return names.join(" + ");
}

function mealRealismScore(items) {
  let score = 0;
  const types = items.map(inferType);
  if (types.includes("protein")) score += 80;
  if (types.includes("carb")) score += 25;
  if (types.includes("vegetable")) score += 25;
  if (types.includes("fruit") && items.some((i) => mealStyle(i) === "sweet_bowl")) score += 15;
  if (types.includes("fat")) score += 10;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (!compatible(items[i], items[j])) score -= 500;
  const fat = items.find((i) => inferType(i) === "fat");
  const protein = items.find((i) => inferType(i) === "protein");
  if (fat && protein && isSweetFat(fat) && isSavoryProtein(protein)) score -= 500;
  return score;
}

function scoreCandidate({ totals, goals, candidate, items }) {
  let score = 700 + mealRealismScore(items);
  if (candidate.calories < 250) score -= 60;
  if (candidate.calories > 900) score -= 120;
  const proteinLow = toNum(totals.protein_g) / Math.max(1, goals.protein_g) < 0.85;
  const sugarHigh = toNum(totals.sugar_g) / Math.max(1, goals.sugar_g) > 0.75;
  const fatHigh = toNum(totals.fat_g) / Math.max(1, goals.fat_g) > 0.75;
  if (proteinLow) score += Math.min(180, candidate.protein_g * 5);
  if (proteinLow && candidate.protein_g < 25) score -= 160;
  if (sugarHigh && candidate.sugar_g > 10) score -= 180;
  if (fatHigh && candidate.fat_g > 18) score -= 140;
  for (const key of MACROS) {
    const after = pctAfter(totals, candidate, goals, key);
    if (["calories", "protein_g", "carbs_g"].includes(key) && after > 1.18) score -= 220 * (after - 1.18);
    if (["sugar_g", "fat_g"].includes(key) && after > 1.05) score -= 280 * (after - 1.05);
  }
  return round1(score);
}

function reasonFor(totals, goals, candidate) {
  const reasons = [];
  const p = (key) => toNum(totals[key]) / Math.max(1, toNum(goals[key]));
  if (p("protein_g") < 0.8) reasons.push("adds protein without making the meal weird");
  if (p("calories") < 0.8) reasons.push("uses some of the calories left today");
  if (p("fiber_g") < 0.8 && candidate.fiber_g >= 3) reasons.push("helps fiber a bit");
  if (p("sugar_g") > 0.7) reasons.push("keeps sugar controlled");
  if (p("fat_g") > 0.7) reasons.push("doesn’t push fat too hard");
  if (!reasons.length) reasons.push("keeps the next meal balanced");
  return `Picked because it ${reasons.join(", ")}.`;
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

function pushIfRealistic(candidates, { totals, goals, items }) {
  if (!items.length) return;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (!compatible(items[i], items[j])) return;
  const totalsForMeal = sum(items);
  if (totalsForMeal.calories < 150) return;
  if (totalsForMeal.calories > 1000) return;
  if (pctAfter(totals, totalsForMeal, goals, "sugar_g") > 1.2) return;
  if (pctAfter(totals, totalsForMeal, goals, "fat_g") > 1.25) return;
  if (pctAfter(totals, totalsForMeal, goals, "calories") > 1.18) return;
  const score = scoreCandidate({ totals, goals, candidate: totalsForMeal, items });
  if (score < 250) return;
  candidates.push({ title: titleFor(items), items, totals: totalsForMeal, score, reason: reasonFor(totals, goals, totalsForMeal) });
}

function validateWithOpenAISync(candidates) {
  if (!process.env.OPENAI_API_KEY || !candidates.length) return candidates;
  const limited = candidates.slice(0, Math.min(12, candidates.length));
  const input = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    options: limited.map((option, index) => ({
      index,
      title: option.title,
      items: option.items.map((item) => ({ name: item.food_name, quantity: item.quantity, unit: item.unit }))
    }))
  };
  const code = `
const fs = require('fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const schema = { type:'object', additionalProperties:false, required:['results'], properties:{ results:{ type:'array', items:{ type:'object', additionalProperties:false, required:['index','is_realistic','title','reason'], properties:{ index:{type:'number'}, is_realistic:{type:'boolean'}, title:{type:'string'}, reason:{type:'string'} } } } } };
(async () => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify({
      model: input.model,
      temperature: 0,
      messages:[
        { role:'system', content:'You are a meal realism checker. Reject random macro piles and food pairings a normal person would not eat. Reject salmon with peanut butter, fish with yogurt, steak with berries, random fruit beside meat, or multiple unrelated main proteins. Accept normal meals like chicken rice broccoli, salmon potato salad, eggs toast fruit, Greek yogurt berries oats, tuna sandwich, beef rice vegetables. Return only JSON.' },
        { role:'user', content: JSON.stringify({ options: input.options }) }
      ],
      response_format:{ type:'json_schema', json_schema:{ name:'meal_realism_check', strict:true, schema } }
    })
  });
  const data = await response.json();
  process.stdout.write(data.choices?.[0]?.message?.content || JSON.stringify({ results: input.options.map(o => ({ index:o.index, is_realistic:true, title:o.title, reason:'No AI result' })) }));
})().catch(() => process.stdout.write(JSON.stringify({ results: input.options.map(o => ({ index:o.index, is_realistic:true, title:o.title, reason:'AI validation failed open' })) })));
`;
  try {
    const raw = execFileSync(process.execPath, ["-e", code], { input: JSON.stringify(input), encoding: "utf8", timeout: 18000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(raw);
    const acceptedIndexes = new Set((parsed.results || []).filter((r) => r.is_realistic).map((r) => Number(r.index)));
    const titleByIndex = new Map((parsed.results || []).map((r) => [Number(r.index), r.title]));
    const reasonByIndex = new Map((parsed.results || []).map((r) => [Number(r.index), r.reason]));
    const accepted = limited.filter((_, index) => acceptedIndexes.has(index)).map((option, index) => ({
      ...option,
      title: titleByIndex.get(index) || option.title,
      reason: reasonByIndex.get(index) || option.reason
    }));
    return accepted.length ? accepted : candidates.slice(0, 5);
  } catch (error) {
    return candidates;
  }
}

export function generateRecommendations({ totals, goals, foods, count = 5 }) {
  const groups = classifyFoods(foods);
  const proteins = groups.protein.length ? groups.protein : foods.filter((f) => toNum(f.protein_g) >= 5);
  const carbs = groups.carb.length ? groups.carb : foods.filter((f) => toNum(f.carbs_g) >= 10);
  const vegetables = groups.vegetable.length ? groups.vegetable : foods.filter((f) => toNum(f.fiber_g) >= 2);
  const fruits = groups.fruit;
  const fats = groups.fat;
  const candidates = [];

  for (const p of proteins.slice(0, 14)) {
    for (const pf of portionFactors(p)) {
      const pItem = candidatePart(p, pf);
      pushIfRealistic(candidates, { totals, goals, items: [pItem] });
      for (const c of carbs.slice(0, 14)) {
        if (!compatible(p, c)) continue;
        for (const cf of portionFactors(c)) {
          const cItem = candidatePart(c, cf);
          pushIfRealistic(candidates, { totals, goals, items: [pItem, cItem] });
          for (const v of vegetables.slice(0, 10)) {
            if (!compatible(p, v) || !compatible(c, v)) continue;
            for (const vf of portionFactors(v).slice(0, 2)) pushIfRealistic(candidates, { totals, goals, items: [pItem, cItem, candidatePart(v, vf)] });
          }
        }
      }
      for (const v of vegetables.slice(0, 10)) {
        if (!compatible(p, v)) continue;
        for (const vf of portionFactors(v).slice(0, 2)) pushIfRealistic(candidates, { totals, goals, items: [pItem, candidatePart(v, vf)] });
      }
    }
  }

  const sweetProteins = proteins.filter((p) => mealStyle(p) === "sweet_bowl");
  const sweetCarbs = [...fruits, ...carbs.filter((c) => mealStyle(c) === "sweet_bowl")];
  const sweetFats = fats.filter(isSweetFat);
  for (const p of sweetProteins.slice(0, 8)) {
    for (const pf of portionFactors(p).slice(0, 2)) {
      const pItem = candidatePart(p, pf);
      for (const c of sweetCarbs.slice(0, 8)) {
        if (!compatible(p, c)) continue;
        const base = [pItem, candidatePart(c, portionFactors(c)[0])];
        pushIfRealistic(candidates, { totals, goals, items: base });
        for (const f of sweetFats.slice(0, 4)) {
          if (!compatible(p, f) || !compatible(c, f)) continue;
          pushIfRealistic(candidates, { totals, goals, items: [...base, candidatePart(f, 0.5)] });
        }
      }
    }
  }

  const unique = [];
  const seenIngredientCombos = new Set();
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const ingredientComboKey = candidate.items.map((i) => String(i.food_name).toLowerCase().trim()).sort().join("|");
    if (seenIngredientCombos.has(ingredientComboKey)) continue;
    seenIngredientCombos.add(ingredientComboKey);
    unique.push(candidate);
  }

  return validateWithOpenAISync(unique).slice(0, count);
}

export function macroStatus(totals, goals) {
  const status = {};
  for (const key of MACROS) {
    const pct = toNum(totals[key]) / Math.max(1, toNum(goals[key]));
    status[key] = { pct: round0(pct * 100), level: pct < 0.6 ? "low" : pct < 0.9 ? "on-track" : pct <= 1.05 ? "near" : "over" };
  }
  return status;
}
