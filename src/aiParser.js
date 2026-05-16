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
    response_format: { type: "json_schema", json_schema: { name: "meal_parse", strict: true, schema: mealSchema } }
  });
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI parser returned no content.");
  return JSON.parse(content);
}

export async function parseMealWithAI(rawText) {
  return createStructuredMeal([
    {
      role: "system",
      content: "You parse meal log messages into JSON. Extract every food item. If the user says a known preset like smoothie, return one item named Dad Smoothie with quantity 1 and unit serving. Use realistic nutrition estimates only if the item may not exist in the user's saved food database. If quantity is vague, choose a normal serving and mark confidence low. Do not give medical advice."
    },
    { role: "user", content: rawText }
  ]);
}

export async function parseEditedMealWithAI({ previousRawMessage, previousItems, editInstruction }) {
  return createStructuredMeal([
    {
      role: "system",
      content: "You edit the user's most recent logged meal and output the corrected meal as JSON. Use the previous meal and the correction instruction. Preserve unchanged foods. If the user says replace the whole meal, use the new meal. If unclear, make the smallest reasonable correction."
    },
    {
      role: "user",
      content: [
        "Previous raw meal message:", previousRawMessage,
        "", "Previously logged items:", JSON.stringify(previousItems, null, 2),
        "", "Correction instruction:", editInstruction
      ].join("\n")
    }
  ]);
}
