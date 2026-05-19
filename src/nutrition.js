import { canonicalUnit, normalizeText, round1 } from "./utils.js";

function namesForFood(food) {
  return [food.name, ...(food.aliases || [])].map(normalizeText).filter(Boolean);
}

export function findFoodMatch(parsedItem, foods) {
  const itemName = normalizeText(parsedItem.food_name);
  let best = null;
  let bestScore = 0;

  for (const food of foods) {
    for (const candidate of namesForFood(food)) {
      let score = 0;
      if (itemName === candidate) score = 100;
      else if (itemName.includes(candidate)) score = 80;
      else if (candidate.includes(itemName)) score = 70;

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

  if (parsedUnit === baseUnit && baseQty !== 0) {
    factor = qty / baseQty;
    note = `Matched known food: ${matchedFood.name}.`;
  } else {
    factor = 1;
    note = `Matched known food: ${matchedFood.name}. Used base portion because unit did not match: "${parsedItem.unit}" vs "${matchedFood.base_unit}".`;
  }

  return scaledFoodItem(matchedFood, factor, {
    quantity: qty,
    unit: parsedItem.unit || matchedFood.base_unit,
    confidence: "high",
    note
  });
}

export function scaledFoodItem(food, factor = 1, extra = {}) {
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
    confidence: extra.confidence || "high",
    note: extra.note || ""
  };
}

export function useAiEstimatedFood(parsedItem) {
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
    confidence: parsedItem.confidence || "low",
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
