import { query } from "./db.js";
import { resolveUserId } from "./userContext.js";

export const DEFAULT_RECOMMENDED_MEALS = ["breakfast", "lunch", "dinner", "snack"];
const ALLOWED = new Set(DEFAULT_RECOMMENDED_MEALS);

export function sanitizeRecommendedMeals(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const clean = list.map((item) => String(item || "").toLowerCase().trim()).filter((item) => ALLOWED.has(item));
  return clean.length ? [...new Set(clean)] : DEFAULT_RECOMMENDED_MEALS;
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_recommendation_settings (
      telegram_user_id TEXT PRIMARY KEY,
      recommended_meals TEXT[] NOT NULL DEFAULT ARRAY['breakfast','lunch','dinner','snack'],
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function getRecommendedMeals(userId) {
  await ensureTable();
  const result = await query(`SELECT recommended_meals FROM user_recommendation_settings WHERE telegram_user_id = $1`, [resolveUserId(userId)]);
  return sanitizeRecommendedMeals(result.rows[0]?.recommended_meals || DEFAULT_RECOMMENDED_MEALS);
}

export async function setRecommendedMeals(userId, meals) {
  await ensureTable();
  const recommendedMeals = sanitizeRecommendedMeals(meals);
  await query(`
    INSERT INTO user_recommendation_settings (telegram_user_id, recommended_meals, updated_at)
    VALUES ($1, $2, now())
    ON CONFLICT (telegram_user_id)
    DO UPDATE SET recommended_meals = EXCLUDED.recommended_meals, updated_at = now();
  `, [resolveUserId(userId), recommendedMeals]);
  return recommendedMeals;
}

export function mealSlotLabel(value) {
  return String(value || "").replace("_", " ").replace(/^./, (c) => c.toUpperCase());
}
