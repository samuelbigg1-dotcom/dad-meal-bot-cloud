import OpenAI from "openai";

let openaiClient = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing.");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

const mealSchema = {
  type: "object",
  additionalProperties: false,
  required: ["meal_type", "items"],
  properties: {
    meal_type: { type: "string", enum: ["breakfast", "late_breakfast", "lunch", "dinner", "snack", "smoothie", "meal", "unknown"] },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["food_name", "quantity", "unit", "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "confidence", "confidence_percent", "note"],
        properties: {
          food_name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          sugar_g: { type: "number" },
          fiber_g: { type: "number" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          confidence_percent: { type: "number", minimum: 10, maximum: 100 },
          note: { type: "string" }
        }
      }
    }
  }
};

async function createStructuredMeal(messages) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const completion = await getOpenAIClient().chat.completions.create({
    model,
    temperature: 0,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: { name: "meal_parse", strict: true, schema: mealSchema }
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI parser returned no content.");
  return JSON.parse(content);
}

export async function parseMealWithAI(rawText, selectedMealType = "meal") {
  return createStructuredMeal([
    {
      role: "system",
      content: `You parse meal log messages into JSON for a macro tracker.

Core rules:
- Extract every food item.
- The selected meal type is provided separately, so do not require the user to type breakfast/lunch/dinner.
- Preserve compound foods as compound foods. Blueberry muffin means blueberry muffin, not blueberries. Banana bread means banana bread, not bananas. Protein bar means protein bar, not protein powder.
- If the user says a known preset like smoothie, use one item named Dad Smoothie.
- Do not give medical advice.

Confidence rules:
- confidence_percent must be a real 10 to 100 score for how likely the nutrition estimate is correct.
- 90-100: saved food match, barcode/label data, or very standard item with clear quantity.
- 70-89: reasonable estimate but brand/portion could vary.
- 40-69: restaurant/branded food, vague size, drink customization, or uncertain portion.
- 10-39: highly uncertain or missing important details.
- confidence label should match the percent: high >= 85, medium 60-84, low < 60.

Accuracy rules:
- Restaurant, fast-food, coffee-shop, and branded items must be treated as branded items, not generic homemade foods.
- If the brand/restaurant is named, include it in food_name.
- Use official/common branded nutrition if you know it confidently.
- Starbucks Crispy Grilled Cheese on Sourdough is about 520 calories per sandwich. If the user says 2, total it as about 1040 calories.
- Tim Hortons medium Original Iced Capp made with cream is about 330 to 360 calories per medium drink. Do not parse it as a generic cappuccino.
- If size/customization is unclear for a restaurant drink, use the common/default version and set confidence below 60 with a note explaining what assumption was used.
- Never return an obviously low generic estimate for branded restaurant foods. If unsure, err toward the official branded item estimate and mark confidence low.
- If quantity is vague, choose a normal serving and mark confidence low.
- For chain/restaurant foods where nutrition varies by region or customization, put that uncertainty in note.`
    },
    { role: "user", content: JSON.stringify({ selectedMealType, mealText: rawText }) }
  ]);
}

export async function validateRecommendationsWithAI({ options }) {
  if (!process.env.OPENAI_API_KEY || !options.length) {
    return options.map((option, index) => ({ index, is_realistic: true, title: option.title, reason: "AI validation skipped." }));
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "is_realistic", "title", "reason", "fix_note"],
          properties: {
            index: { type: "number" },
            is_realistic: { type: "boolean" },
            title: { type: "string" },
            reason: { type: "string" },
            fix_note: { type: "string" }
          }
        }
      }
    }
  };

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const completion = await getOpenAIClient().chat.completions.create({
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `You are a meal realism checker for a macro tracker.
Your job is NOT to optimize macros. Your job is to decide if a suggested meal is something a normal person would actually eat.
Reject weird macro piles, random combinations, clashing flavors, or items that only make sense separately.
Examples to reject: salmon with peanut butter, tuna with yogurt, steak with berries, random fruit beside chicken, multiple unrelated proteins.
Examples to accept: chicken rice broccoli, salmon potato salad, eggs toast fruit, Greek yogurt berries oats, cottage cheese berries, tuna sandwich, beef rice vegetables.
Return is_realistic=false for anything awkward, gross, confusing, or not a real meal.
Keep titles short and human.`
      },
      {
        role: "user",
        content: JSON.stringify({
          options: options.map((option, index) => ({
            index,
            title: option.title,
            items: option.items.map((item) => ({ name: item.food_name, quantity: item.quantity, unit: item.unit }))
          }))
        }, null, 2)
      }
    ],
    response_format: { type: "json_schema", json_schema: { name: "meal_realism_check", strict: true, schema } }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) return options.map((option, index) => ({ index, is_realistic: true, title: option.title, reason: "AI validation returned no content.", fix_note: "" }));
  return JSON.parse(content).results || [];
}

export async function explainRecommendationsWithAI({ totals, goals, remaining, options }) {
  if (!process.env.OPENAI_API_KEY || !options.length) {
    return options.map((o) => ({
      title: o.title,
      explanation: o.reason || "This option was selected because it improves today's macro balance."
    }));
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["recommendations"],
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "explanation", "coaching_note"],
          properties: {
            title: { type: "string" },
            explanation: { type: "string" },
            coaching_note: { type: "string" }
          }
        }
      }
    }
  };

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const completion = await getOpenAIClient().chat.completions.create({
    model,
    temperature: 0.35,
    messages: [
      { role: "system", content: "You explain meal recommendations for a macro tracker. The code already did the nutrition math. Do not invent new ingredients or change portions. Explain why each option fits today based on low/high macros. Keep it short, practical, and non-medical." },
      { role: "user", content: JSON.stringify({ totals, goals, remaining, options }, null, 2) }
    ],
    response_format: { type: "json_schema", json_schema: { name: "recommendation_explanations", strict: true, schema } }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) return [];
  return JSON.parse(content).recommendations || [];
}

function scanHasNutritionData(food) {
  const values = [food.calories, food.protein, food.carbs, food.fat, food.sugar, food.fiber].map((value) => Number(value || 0));
  return values.some((value) => Number.isFinite(value) && Math.abs(value) > 0);
}

function validateNutritionLabelScan(food) {
  const confidence = Number(food.labelConfidence || 0);
  const evidence = String(food.labelEvidence || "").toLowerCase();
  const name = String(food.name || "").toLowerCase().trim();
  const genericName = !name || name === "scanned packaged food" || name === "packaged food";
  const hasLabelWords = /nutrition|facts|serving|calories|protein|carb|fat|sugar|fiber|sodium|cholesterol/.test(evidence);
  const hasCoreValues = Number(food.calories || 0) > 0 && (Number(food.carbs || 0) > 0 || Number(food.fat || 0) > 0 || Number(food.protein || 0) > 0);

  if (!food.isNutritionLabel && !(hasLabelWords && hasCoreValues)) {
    throw new Error("That photo does not look like a readable Nutrition Facts label. Try a clearer label photo or scan the barcode.");
  }

  if (confidence < 55 && !(hasLabelWords && hasCoreValues)) {
    throw new Error("I could not confidently read a Nutrition Facts label from that photo. Try a closer, clearer label photo or scan the barcode.");
  }

  if (!hasLabelWords && !hasCoreValues) {
    throw new Error("That photo does not show enough Nutrition Facts label text. Try a clearer label photo or scan the barcode.");
  }

  if (!scanHasNutritionData(food)) {
    throw new Error("The scan did not find real nutrition values. Try a clearer Nutrition Facts label or scan the barcode.");
  }

  if (genericName && confidence < 60 && !hasCoreValues) {
    throw new Error("I could not identify this as a real packaged-food label. Try a clearer label photo or scan the barcode.");
  }
}

export async function scanNutritionLabelWithAI(imageDataUrl) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["isNutritionLabel", "labelConfidence", "labelEvidence", "name", "baseQty", "baseUnit", "servingText", "calories", "protein", "carbs", "fat", "sugar", "fiber"],
    properties: {
      isNutritionLabel: { type: "boolean" },
      labelConfidence: { type: "number", minimum: 0, maximum: 100 },
      labelEvidence: { type: "string" },
      name: { type: "string" },
      baseQty: { type: "number" },
      baseUnit: { type: "string" },
      servingText: { type: "string" },
      calories: { type: "number" },
      protein: { type: "number" },
      carbs: { type: "number" },
      fat: { type: "number" },
      sugar: { type: "number" },
      fiber: { type: "number" }
    }
  };

  const completion = await getOpenAIClient().chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `You are a Nutrition Facts label reader for packaged foods.

First decide whether the image visibly contains a real Nutrition Facts label or equivalent packaged-food nutrition table.
Accept the label if you can clearly read core nutrition rows such as serving size, calories, fat, carbohydrate, sugars, protein, sodium, or fiber, even if the package is wrinkled or angled.
Reject walls, rooms, blank surfaces, random objects, food photos without a nutrition table, receipts, menus, and blurry photos.
Never invent nutrition data from a non-label image.
If the image is not a nutrition label, return isNutritionLabel=false, labelConfidence=0, labelEvidence explaining what is missing, name='', baseQty=0, baseUnit='', servingText='', and all nutrition values as 0.
If it is a real label, return nutrition per serving. If a nutrient is truly missing from a visible label, use 0.
Do not invent a brand name. If the food name is not visible but the label is real, use 'Scanned packaged food'.
Use labelEvidence to quote or summarize visible proof, for example 'Nutrition Facts, Serving Size 2 1/4 cups, Calories 240, Fat 10g, Carbohydrate 36g'.
Set labelConfidence based on readability of the visible table, not whether the product name is visible.
Preserve the printed serving size text exactly in servingText, such as '3/4 cup', '2 1/4 cups (50 g)', or '175 g'.
For baseQty/baseUnit, convert common fractions exactly: 1/4 cup = 0.25 cup, 1/2 cup = 0.5 cup, 2/3 cup = 0.667 cup, 3/4 cup = 0.75 cup, 2 1/4 cups = 2.25 cups. Do not round 3/4 cup to 0.8 cup.`
      },
      { role: "user", content: [
        { type: "text", text: "Read this packaged-food Nutrition Facts label if visible. Extract calories, protein, carbs, fat, sugar, and fiber per serving, plus exact servingText. If no nutrition table is visible, reject it with isNutritionLabel=false and zero nutrition values." },
        { type: "image_url", image_url: { url: imageDataUrl } }
      ] }
    ],
    response_format: { type: "json_schema", json_schema: { name: "nutrition_label_scan", strict: true, schema } }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("No nutrition label result returned.");
  const parsed = JSON.parse(content);
  validateNutritionLabelScan(parsed);
  return parsed;
}

export async function scanBarcodeImageWithAI(imageDataUrl) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["barcode"],
    properties: { barcode: { type: "string" } }
  };

  const completion = await getOpenAIClient().chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "You read UPC/EAN barcode numbers from package images. Return only the visible barcode digits. If no barcode is readable, return an empty string." },
      { role: "user", content: [
        { type: "text", text: "Read the barcode number from this image. Return only the digits." },
        { type: "image_url", image_url: { url: imageDataUrl } }
      ] }
    ],
    response_format: { type: "json_schema", json_schema: { name: "barcode_scan", strict: true, schema } }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("No barcode result returned.");
  const parsed = JSON.parse(content);
  return String(parsed.barcode || "").replace(/\D/g, "");
}
