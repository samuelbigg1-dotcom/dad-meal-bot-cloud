import assert from "node:assert/strict";
import { normalizeBarcodeFoodServing, parseServingGrams } from "../src/utils.js";
import { calculateItems, totalItems } from "../src/nutrition.js";
import { generateRecommendations } from "../src/recommendations.js";

function approx(actual, expected, tolerance = 0.2) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

// Regression: OpenFoodFacts sometimes gives only per-100g nutrition.
// Smart Pop popcorn is 250 cal per 45 g on the physical label, but barcode data
// can arrive as roughly 556 cal per 100 g. The app must scale that down.
{
  assert.equal(parseServingGrams("45 g"), 45);
  assert.equal(parseServingGrams("1 package (45 g)"), 45);
  assert.equal(parseServingGrams("serving"), null);

  const { food, scaled } = normalizeBarcodeFoodServing({
    name: "Pop maïs soufflé",
    baseQty: 1,
    baseUnit: "45 g",
    calories: 556,
    protein: 11.1,
    carbs: 51.1,
    fat: 35.6,
    sugar: 4.4,
    fiber: 0
  });

  assert.equal(scaled, true);
  approx(food.calories, 250.2);
  approx(food.protein, 5.0);
  approx(food.carbs, 23.0);
  approx(food.fat, 16.0);
  approx(food.sugar, 2.0);
}

// Already-per-serving data should not be scaled again.
{
  const { food, scaled } = normalizeBarcodeFoodServing({
    name: "Popcorn",
    baseQty: 1,
    baseUnit: "45 g",
    calories: 250,
    protein: 4,
    carbs: 23,
    fat: 16,
    sugar: 3,
    fiber: 3
  });

  assert.equal(scaled, false);
  assert.equal(food.calories, 250);
}

// Food matching should not mistake compound foods for single ingredients.
{
  const foods = [
    { id: 1, name: "Banana", aliases: ["bananas"], base_qty: 1, base_unit: "medium", calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, sugar_g: 14, fiber_g: 3 },
    { id: 2, name: "Blueberry muffin", aliases: ["blueberry muffins"], base_qty: 1, base_unit: "muffin", calories: 385, protein_g: 5, carbs_g: 56, fat_g: 15, sugar_g: 30, fiber_g: 2 }
  ];

  const items = calculateItems({
    items: [
      { food_name: "banana bread", quantity: 1, unit: "slice", calories: 200, protein_g: 4, carbs_g: 35, fat_g: 6, sugar_g: 15, fiber_g: 2, confidence: "low", note: "estimate" },
      { food_name: "blueberry muffin", quantity: 1, unit: "muffin", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sugar_g: 0, fiber_g: 0, confidence: "medium", note: "" }
    ]
  }, foods);

  assert.equal(items[0].matched_food_id, null);
  assert.equal(items[1].matched_food_id, 2);
  assert.equal(totalItems(items).calories, 585);
}

// Recommendation generator should return unique, usable options without throwing.
{
  const totals = { calories: 800, protein_g: 60, carbs_g: 80, fat_g: 20, sugar_g: 20, fiber_g: 8 };
  const goals = { calories: 2600, protein_g: 175, carbs_g: 305, fat_g: 70, sugar_g: 65, fiber_g: 35 };
  const foods = [
    { id: 1, name: "Chicken breast cooked", category: "protein", is_pantry: true, include_in_recommendations: true, base_qty: 1, base_unit: "oz", calories: 47, protein_g: 8.8, carbs_g: 0, fat_g: 1, sugar_g: 0, fiber_g: 0 },
    { id: 2, name: "Rice Basmati", category: "carb", is_pantry: true, include_in_recommendations: true, base_qty: 1, base_unit: "cup", calories: 205, protein_g: 4.3, carbs_g: 44.5, fat_g: 0.4, sugar_g: 0.1, fiber_g: 0.6 },
    { id: 3, name: "Broccoli", category: "vegetable", is_pantry: true, include_in_recommendations: true, base_qty: 1, base_unit: "cup", calories: 31, protein_g: 2.5, carbs_g: 6, fat_g: 0.3, sugar_g: 1.5, fiber_g: 2.5 }
  ];

  const options = generateRecommendations({ totals, goals, foods, count: 3 });
  assert.ok(options.length > 0);
  assert.ok(options.length <= 3);
  assert.ok(options.every((option) => option.totals.calories >= 150));
}

console.log("All tests passed.");
