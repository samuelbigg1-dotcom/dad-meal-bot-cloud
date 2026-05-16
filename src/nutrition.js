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
    note = `Matched known food: ${matchedFood.name}. Scaled ${qty} ${parsedUnit} from base ${baseQty} ${baseUnit}.`;
  } else {
    factor = 1;
    note = `Matched known food: ${matchedFood.name}. Used base portion because unit did not match: "${parsedItem.unit}" vs "${matchedFood.base_unit}".`;
  }

  return {
    food_name: matchedFood.name,
    matched_food_id: matchedFood.id,
    quantity: qty,
    unit: parsedItem.unit || matchedFood.base_unit,
    calories: round1(Number(matchedFood.calories) * factor),
    protein_g: round1(Number(matchedFood.protein_g) * factor),
    carbs_g: round1(Number(matchedFood.carbs_g) * factor),
    fat_g: round1(Number(matchedFood.fat_g) * factor),
    sugar_g: round1(Number(matchedFood.sugar_g) * factor),
    fiber_g: round1(Number(matchedFood.fiber_g) * factor),
    confidence: "high",
    note
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
    note: parsedItem.note || "AI-estimated food. Add it with /addfood for better tracking next time."
  };
}

export function calculateItems(parsedMeal, foods) {
  const items = [];

  for (const parsedItem of parsedMeal.items || []) {
    const matched = findFoodMatch(parsedItem, foods);
    if (matched) {
      items.push(scaleKnownFood(parsedItem, matched));
    } else {
      items.push(useAiEstimatedFood(parsedItem));
    }
  }

  return items;
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
