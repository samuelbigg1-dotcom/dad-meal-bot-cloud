import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
        required: ["food_name", "quantity", "unit", "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "confidence", "note"],
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
          note: { type: "string" }
        }
      }
    }
  }
};

async function createStructuredMeal(messages) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing.");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.1,
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
      content: "You parse meal log messages into JSON. Extract every food item. The selected meal type is provided separately, so do not require the user to type breakfast/lunch/dinner. If the user says a known preset like smoothie, use one item named Dad Smoothie. Important: preserve compound foods as compound foods. For example, blueberry muffin means blueberry muffin, not blueberries; banana bread means banana bread, not bananas; protein bar means protein bar, not protein powder. Use realistic nutrition estimates only when the food may not exist in the user's saved food database. If quantity is vague, choose a normal serving and mark confidence low. Do not give medical advice."
    },
    { role: "user", content: JSON.stringify({ selectedMealType, mealText: rawText }) }
  ]);
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
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content: "You explain meal recommendations for a macro tracker. The code already did the nutrition math. Do not invent new ingredients or change portions. Explain why each option fits today based on low/high macros. Keep it short, practical, and non-medical."
      },
      {
        role: "user",
        content: JSON.stringify({ totals, goals, remaining, options }, null, 2)
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "recommendation_explanations", strict: true, schema }
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) return [];

  return JSON.parse(content).recommendations || [];
}

export async function scanNutritionLabelWithAI(imageDataUrl) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "name",
      "baseQty",
      "baseUnit",
      "calories",
      "protein",
      "carbs",
      "fat",
      "sugar",
      "fiber"
    ],
    properties: {
      name: { type: "string" },
      baseQty: { type: "number" },
      baseUnit: { type: "string" },
      calories: { type: "number" },
      protein: { type: "number" },
      carbs: { type: "number" },
      fat: { type: "number" },
      sugar: { type: "number" },
      fiber: { type: "number" }
    }
  };

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You read Nutrition Facts labels from images. Return nutrition per serving. If a value is missing, use 0. Do not invent a brand name. If the food name is not visible, use 'Scanned packaged food'."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Read this nutrition label. Extract calories, protein, carbs, fat, sugar, and fiber per serving. Also extract serving size as baseQty and baseUnit."
          },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "nutrition_label_scan",
        strict: true,
        schema
      }
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("No nutrition label result returned.");

  return JSON.parse(content);
}
