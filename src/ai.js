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

Accuracy rules:
- Restaurant, fast-food, coffee-shop, and branded items must be treated as branded items, not generic homemade foods.
- If the brand/restaurant is named, include it in food_name.
- Use official/common branded nutrition if you know it confidently.
- Starbucks Crispy Grilled Cheese on Sourdough is about 520 calories per sandwich. If the user says 2, total it as about 1040 calories.
- Tim Hortons medium Original Iced Capp made with cream is about 330 to 360 calories per medium drink. Do not parse it as a generic cappuccino.
- If size/customization is unclear for a restaurant drink, use the common/default version and set confidence to low or medium with a note explaining what assumption was used.
- Never return an obviously low generic estimate for branded restaurant foods. If unsure, err toward the official branded item estimate and mark confidence low.
- If quantity is vague, choose a normal serving and mark confidence low.
- For chained/restaurant foods where nutrition varies by region or customization, put that uncertainty in note.`
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
  const completion = await getOpenAIClient().chat.completions.create({
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

  const completion = await getOpenAIClient().chat.completions.create({
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

export async function scanBarcodeImageWithAI(imageDataUrl) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["barcode"],
    properties: {
      barcode: { type: "string" }
    }
  };

  const completion = await getOpenAIClient().chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You read UPC/EAN barcode numbers from package images. Return only the visible barcode digits. If no barcode is readable, return an empty string."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read the barcode number from this image. Return only the digits."
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
        name: "barcode_scan",
        strict: true,
        schema
      }
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("No barcode result returned.");

  const parsed = JSON.parse(content);
  return String(parsed.barcode || "").replace(/\D/g, "");
}
