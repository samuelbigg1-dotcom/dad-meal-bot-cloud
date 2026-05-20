import { canonicalUnit, normalizeText, round1 } from "./utils.js";

function namesForFood(food) {
  return [food.name, ...(food.aliases || [])].map(normalizeText).filter(Boolean);
}

function clampConfidence(value, fallback = 65) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(10, Math.min(100, Math.round(n)));
}

function confidenceFallback(label) {
  if (label === "high") return 92;
  if (label === "low") return 45;
  return 65;
}

export function findFoodMatch(parsedItem, foods) {
  const itemName = normalizeText(parsedItem.food_name);
  const compoundWords = new Set(["muffin", "muffins", "bread", "cake", "cookie", "cookies", "bar", "bars", "pie", "pancake", "pancakes", "waffle", "waffles", "cereal", "granola"]);
  const itemWords = new Set(itemName.split(" ").filter(Boolean));
  const hasCompoundWord = [...compoundWords].some((word) => itemWords.has(word));

  let best = null;
  let bestScore = 0;

  for (const food of foods) {
    for (const candidate of namesForFood(food)) {
      let score = 0;
      if (itemName === candidate) score = 100;
      else if (candidate.endsWith("s") && itemName === candidate.slice(0, -1)) score = 98;
      else if (`${itemName}s` === candidate) score = 98;
      else if (itemName.includes(candidate)) {
        const candidateWords = new Set(candidate.split(" ").filter(Boolean));
        const candidateIsOnlyOneIngredient = candidateWords.size === 1;
        if (hasCompoundWord && candidateIsOnlyOneIngredient && !compoundWords.has([...candidateWords][0])) score = 0;
        else score = 80;
      } else if (candidate.includes(itemName)) score = 70;
      if (score > bestScore) {
        best = food;
        bestScore = score;
      }
    }
  }
  return bestScore >= 70 ? best : null;
}

export function scaleKnownFood(parsedItem, matchedFood) {
  const parsedUnit = canonicalUnit(parsedItem.unit);
  const baseUnit = canonicalUnit(matchedFood.base_unit);
  const qty = Number(parsedItem.quantity || 1);
  const baseQty = Number(matchedFood.base_qty || 1);

  let factor = 1;
  let note = "";
  let confidencePercent = 94;

  if (parsedUnit === baseUnit && baseQty !== 0) {
    factor = qty / baseQty;
    note = `Matched known food: ${matchedFood.name}.`;
  } else {
    factor = 1;
    confidencePercent = 78;
    note = `Matched known food: ${matchedFood.name}. Used base portion because unit did not match: "${parsedItem.unit}" vs "${matchedFood.base_unit}".`;
  }

  return scaledFoodItem(matchedFood, factor, {
    quantity: qty,
    unit: parsedItem.unit || matchedFood.base_unit,
    confidence: confidencePercent >= 85 ? "high" : "medium",
    confidence_percent: confidencePercent,
    note
  });
}

export function scaledFoodItem(food, factor = 1, extra = {}) {
  const confidence = extra.confidence || "high";
  return {
    food_name: food.name,
    matched_food_id: food.id || null,
    quantity: extra.quantity ?? round1(Number(food.base_qty || 1) * factor),
    unit: extra.unit || food.base_unit,
    calories: round1(Number(food.calories) * factor),
    protein_g: round1(Number(food.protein_g) * factor),
    carbs_g: round1(Number(food.carbs_g) * factor),
    fat_g: round1(Number(food.fat_g) * factor),
    sugar_g: round1(Number(food.sugar_g) * factor),
    fiber_g: round1(Number(food.fiber_g) * factor),
    confidence,
    confidence_percent: clampConfidence(extra.confidence_percent ?? extra.confidencePercent, confidenceFallback(confidence)),
    note: extra.note || ""
  };
}

export function useAiEstimatedFood(parsedItem) {
  const confidence = parsedItem.confidence || "low";
  return {
    food_name: parsedItem.food_name,
    matched_food_id: null,
    quantity: parsedItem.quantity || 1,
    unit: parsedItem.unit || "serving",
    calories: round1(parsedItem.calories || 0),
    protein_g: round1(parsedItem.protein_g || 0),
    carbs_g: round1(parsedItem.carbs_g || 0),
    fat_g: round1(parsedItem.fat_g || 0),
    sugar_g: round1(parsedItem.sugar_g || 0),
    fiber_g: round1(parsedItem.fiber_g || 0),
    confidence,
    confidence_percent: clampConfidence(parsedItem.confidence_percent ?? parsedItem.confidencePercent, confidenceFallback(confidence)),
    note: parsedItem.note || "AI-estimated food. Add it under Foods for better tracking next time."
  };
}

export function calculateItems(parsedMeal, foods) {
  return (parsedMeal.items || []).map((parsedItem) => {
    const matched = findFoodMatch(parsedItem, foods);
    return matched ? scaleKnownFood(parsedItem, matched) : useAiEstimatedFood(parsedItem);
  });
}

export function totalItems(items) {
  return {
    calories: round1(items.reduce((sum, item) => sum + Number(item.calories || 0), 0)),
    protein_g: round1(items.reduce((sum, item) => sum + Number(item.protein_g || 0), 0)),
    carbs_g: round1(items.reduce((sum, item) => sum + Number(item.carbs_g || 0), 0)),
    fat_g: round1(items.reduce((sum, item) => sum + Number(item.fat_g || 0), 0)),
    sugar_g: round1(items.reduce((sum, item) => sum + Number(item.sugar_g || 0), 0)),
    fiber_g: round1(items.reduce((sum, item) => sum + Number(item.fiber_g || 0), 0))
  };
}
