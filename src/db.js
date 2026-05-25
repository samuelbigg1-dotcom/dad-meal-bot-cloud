import pg from "pg";
import { DEFAULT_FOODS } from "./seedFoods.js";
import { normalizeBarcodeFoodServing } from "./utils.js";
import { resolveUserId, getContextUserId } from "./userContext.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false }
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

function userId(value) {
  return resolveUserId(value);
}

function currentOwner() {
  return getContextUserId();
}

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS foods (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT[] NOT NULL DEFAULT '{}',
      base_qty NUMERIC NOT NULL,
      base_unit TEXT NOT NULL,
      calories NUMERIC NOT NULL,
      protein_g NUMERIC NOT NULL,
      carbs_g NUMERIC NOT NULL,
      fat_g NUMERIC NOT NULL,
      sugar_g NUMERIC NOT NULL DEFAULT 0,
      fiber_g NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';`);
  await query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS is_pantry BOOLEAN NOT NULL DEFAULT true;`);
  await query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS include_in_recommendations BOOLEAN NOT NULL DEFAULT true;`);
  await query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS owner_user_id TEXT;`);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_user_id TEXT PRIMARY KEY,
      first_name TEXT,
      calorie_goal NUMERIC DEFAULT 2600,
      protein_goal_g NUMERIC DEFAULT 175,
      carbs_goal_g NUMERIC DEFAULT 305,
      fat_goal_g NUMERIC DEFAULT 70,
      sugar_goal_g NUMERIC DEFAULT 65,
      fiber_goal_g NUMERIC DEFAULT 35,
      timezone TEXT DEFAULT 'America/Vancouver',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users (google_id) WHERE google_id IS NOT NULL;`);
  await query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);`);

  await query(`
    CREATE TABLE IF NOT EXISTS meals (
      id SERIAL PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      meal_date DATE NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'meal',
      raw_message TEXT NOT NULL,
      calories NUMERIC NOT NULL DEFAULT 0,
      protein_g NUMERIC NOT NULL DEFAULT 0,
      carbs_g NUMERIC NOT NULL DEFAULT 0,
      fat_g NUMERIC NOT NULL DEFAULT 0,
      sugar_g NUMERIC NOT NULL DEFAULT 0,
      fiber_g NUMERIC NOT NULL DEFAULT 0,
      edited_from_meal_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS meal_items (
      id SERIAL PRIMARY KEY,
      meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      food_name TEXT NOT NULL,
      matched_food_id INTEGER REFERENCES foods(id),
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'serving',
      calories NUMERIC NOT NULL DEFAULT 0,
      protein_g NUMERIC NOT NULL DEFAULT 0,
      carbs_g NUMERIC NOT NULL DEFAULT 0,
      fat_g NUMERIC NOT NULL DEFAULT 0,
      sugar_g NUMERIC NOT NULL DEFAULT 0,
      fiber_g NUMERIC NOT NULL DEFAULT 0,
      confidence TEXT NOT NULL DEFAULT 'medium',
      note TEXT
    );
  `);
  await query(`ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS confidence_percent NUMERIC NOT NULL DEFAULT 65;`);

  await query(`
    CREATE TABLE IF NOT EXISTS weights (
      id SERIAL PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      weight_date DATE NOT NULL,
      weight_lb NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (telegram_user_id, weight_date)
    );
  `);

  for (const food of DEFAULT_FOODS) {
    await addFood({ ...food, owner_user_id: null });
  }
}

export async function upsertUser({ userId: rawUserId, firstName = "Dad", timezone = "America/Vancouver", email = null, googleId = null, avatarUrl = null }) {
  const id = userId(rawUserId);
  await query(`
    INSERT INTO users (telegram_user_id, first_name, timezone, email, google_id, avatar_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (telegram_user_id)
    DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, users.first_name),
      timezone = COALESCE(users.timezone, EXCLUDED.timezone),
      email = COALESCE(EXCLUDED.email, users.email),
      google_id = COALESCE(EXCLUDED.google_id, users.google_id),
      avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url);
  `, [id, firstName, timezone, email, googleId, avatarUrl]);
}

export async function getUser(rawUserId) {
  const result = await query(`SELECT * FROM users WHERE telegram_user_id = $1`, [userId(rawUserId)]);
  return result.rows[0] || null;
}

export async function getFoods(rawUserId = null) {
  const owner = userId(rawUserId || currentOwner() || "dad");
  const result = await query(`
    SELECT * FROM foods
    WHERE owner_user_id IS NULL OR owner_user_id = $1
    ORDER BY name ASC
  `, [owner]);
  return result.rows;
}

export async function getRecommendationFoods(rawUserId = null) {
  const owner = userId(rawUserId || currentOwner() || "dad");
  const result = await query(`
    SELECT * FROM foods
    WHERE (owner_user_id IS NULL OR owner_user_id = $1)
      AND is_pantry = true
      AND include_in_recommendations = true
    ORDER BY category ASC, name ASC
  `, [owner]);
  return result.rows;
}

export async function addFood(food) {
  const owner = food.owner_user_id === null ? null : (food.owner_user_id || currentOwner());
  const { food: normalizedFood } = normalizeBarcodeFoodServing({
    ...food,
    baseUnit: food.base_unit || food.baseUnit,
    protein: food.protein_g ?? food.protein,
    carbs: food.carbs_g ?? food.carbs,
    fat: food.fat_g ?? food.fat,
    sugar: food.sugar_g ?? food.sugar,
    fiber: food.fiber_g ?? food.fiber
  });

  const result = await query(`
    INSERT INTO foods
      (name, aliases, base_qty, base_unit, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, category, is_pantry, include_in_recommendations, owner_user_id)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (name)
    DO UPDATE SET
      aliases = EXCLUDED.aliases,
      base_qty = EXCLUDED.base_qty,
      base_unit = EXCLUDED.base_unit,
      calories = EXCLUDED.calories,
      protein_g = EXCLUDED.protein_g,
      carbs_g = EXCLUDED.carbs_g,
      fat_g = EXCLUDED.fat_g,
      sugar_g = EXCLUDED.sugar_g,
      fiber_g = EXCLUDED.fiber_g,
      category = COALESCE(NULLIF(EXCLUDED.category, ''), foods.category),
      is_pantry = EXCLUDED.is_pantry,
      include_in_recommendations = EXCLUDED.include_in_recommendations,
      owner_user_id = COALESCE(foods.owner_user_id, EXCLUDED.owner_user_id)
    RETURNING *;
  `, [
    normalizedFood.name,
    normalizedFood.aliases || [],
    Number(normalizedFood.base_qty ?? normalizedFood.baseQty),
    normalizedFood.base_unit || normalizedFood.baseUnit,
    Number(normalizedFood.calories),
    Number(normalizedFood.protein_g ?? normalizedFood.protein),
    Number(normalizedFood.carbs_g ?? normalizedFood.carbs),
    Number(normalizedFood.fat_g ?? normalizedFood.fat),
    Number(normalizedFood.sugar_g ?? normalizedFood.sugar),
    Number(normalizedFood.fiber_g ?? normalizedFood.fiber),
    normalizedFood.category || "",
    normalizedFood.is_pantry ?? true,
    normalizedFood.include_in_recommendations ?? true,
    owner
  ]);

  return result.rows[0];
}

export async function updateFoodFlags(id, { isPantry, includeInRecommendations }) {
  await query(`
    UPDATE foods SET
      is_pantry = COALESCE($2, is_pantry),
      include_in_recommendations = COALESCE($3, include_in_recommendations)
    WHERE id = $1
  `, [id, isPantry, includeInRecommendations]);
}

export async function deleteFood(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE meal_items SET matched_food_id = NULL WHERE matched_food_id = $1;`, [id]);
    await client.query(`DELETE FROM foods WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`, [id, currentOwner()]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertMealWithClient(client, { userId: rawUserId, mealDate, mealType, rawMessage, totals, items, editedFromMealId = null }) {
  const uid = userId(rawUserId);
  const mealResult = await client.query(`
    INSERT INTO meals
      (telegram_user_id, meal_date, meal_type, raw_message, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, edited_from_meal_id)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *;
  `, [uid, mealDate, mealType || "meal", rawMessage, totals.calories, totals.protein_g, totals.carbs_g, totals.fat_g, totals.sugar_g, totals.fiber_g, editedFromMealId]);

  const meal = mealResult.rows[0];

  for (const item of items) {
    await client.query(`
      INSERT INTO meal_items
        (meal_id, food_name, matched_food_id, quantity, unit, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, confidence, confidence_percent, note)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14);
    `, [
      meal.id,
      item.food_name,
      item.matched_food_id || null,
      item.quantity || 1,
      item.unit || "serving",
      item.calories || 0,
      item.protein_g || 0,
      item.carbs_g || 0,
      item.fat_g || 0,
      item.sugar_g || 0,
      item.fiber_g || 0,
      item.confidence || "medium",
      Number(item.confidence_percent || item.confidencePercent || (item.confidence === "high" ? 92 : item.confidence === "low" ? 45 : 65)),
      item.note || null
    ]);
  }

  return meal;
}

export async function saveMeal(args) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const meal = await insertMealWithClient(client, args);
    await client.query("COMMIT");
    return meal.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function replaceLastMeal(args) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const uid = userId(args.userId);
    const lastResult = await client.query(`SELECT * FROM meals WHERE telegram_user_id = $1 ORDER BY created_at DESC LIMIT 1;`, [uid]);
    const last = lastResult.rows[0];
    if (!last) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(`DELETE FROM meals WHERE id = $1`, [last.id]);
    const meal = await insertMealWithClient(client, { ...args, userId: uid, editedFromMealId: last.id });
    await client.query("COMMIT");
    return meal;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLastMealWithItems(rawUserId) {
  const mealResult = await query(`SELECT * FROM meals WHERE telegram_user_id = $1 ORDER BY created_at DESC LIMIT 1;`, [userId(rawUserId)]);
  const meal = mealResult.rows[0];
  if (!meal) return null;
  const itemsResult = await query(`SELECT * FROM meal_items WHERE meal_id = $1 ORDER BY id ASC`, [meal.id]);
  return { meal, items: itemsResult.rows };
}

export async function getMealById(rawUserId, mealId) {
  const result = await query(`SELECT *, meal_date::text AS meal_date FROM meals WHERE telegram_user_id = $1 AND id = $2`, [userId(rawUserId), mealId]);
  return result.rows[0] || null;
}

export async function updateMealWithItems({ mealId, userId: rawUserId, mealDate, mealType, rawMessage, totals, items }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const uid = userId(rawUserId);
    const existing = await client.query(`SELECT id FROM meals WHERE telegram_user_id = $1 AND id = $2`, [uid, mealId]);
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(`
      UPDATE meals SET
        meal_date = $3,
        meal_type = $4,
        raw_message = $5,
        calories = $6,
        protein_g = $7,
        carbs_g = $8,
        fat_g = $9,
        sugar_g = $10,
        fiber_g = $11
      WHERE telegram_user_id = $1 AND id = $2
      RETURNING *;
    `, [uid, mealId, mealDate, mealType || "meal", rawMessage, totals.calories, totals.protein_g, totals.carbs_g, totals.fat_g, totals.sugar_g, totals.fiber_g]);
    await client.query(`DELETE FROM meal_items WHERE meal_id = $1`, [mealId]);
    for (const item of items) {
      await client.query(`
        INSERT INTO meal_items
          (meal_id, food_name, matched_food_id, quantity, unit, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, confidence, confidence_percent, note)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14);
      `, [
        mealId,
        item.food_name,
        item.matched_food_id || null,
        item.quantity || 1,
        item.unit || "serving",
        item.calories || 0,
        item.protein_g || 0,
        item.carbs_g || 0,
        item.fat_g || 0,
        item.sugar_g || 0,
        item.fiber_g || 0,
        item.confidence || "medium",
        Number(item.confidence_percent || item.confidencePercent || (item.confidence === "high" ? 92 : item.confidence === "low" ? 45 : 65)),
        item.note || null
      ]);
    }
    await client.query("COMMIT");
    return mealId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getDailyTotals(rawUserId, mealDate) {
  const result = await query(`
    SELECT COALESCE(SUM(calories), 0) AS calories, COALESCE(SUM(protein_g), 0) AS protein_g, COALESCE(SUM(carbs_g), 0) AS carbs_g, COALESCE(SUM(fat_g), 0) AS fat_g, COALESCE(SUM(sugar_g), 0) AS sugar_g, COALESCE(SUM(fiber_g), 0) AS fiber_g
    FROM meals
    WHERE telegram_user_id = $1 AND meal_date = $2;
  `, [userId(rawUserId), mealDate]);
  return result.rows[0];
}

export async function getMealsForDate(rawUserId, mealDate) {
  const result = await query(`
    SELECT * FROM meals
    WHERE telegram_user_id = $1 AND meal_date = $2
    ORDER BY created_at ASC;
  `, [userId(rawUserId), mealDate]);
  return result.rows;
}

export async function getMealItems(mealId) {
  const result = await query(`SELECT * FROM meal_items WHERE meal_id = $1 ORDER BY id ASC`, [mealId]);
  return result.rows;
}

export async function deleteMeal(id, rawUserId) {
  await query(`DELETE FROM meals WHERE id = $1 AND telegram_user_id = $2`, [id, userId(rawUserId)]);
}

export async function getWeeklyTotals(rawUserId, startDate, endDate) {
  const result = await query(`
    SELECT meal_date::text AS meal_date, COALESCE(SUM(calories), 0) AS calories, COALESCE(SUM(protein_g), 0) AS protein_g, COALESCE(SUM(carbs_g), 0) AS carbs_g, COALESCE(SUM(fat_g), 0) AS fat_g, COALESCE(SUM(sugar_g), 0) AS sugar_g, COALESCE(SUM(fiber_g), 0) AS fiber_g
    FROM meals
    WHERE telegram_user_id = $1 AND meal_date >= $2 AND meal_date <= $3
    GROUP BY meal_date
    ORDER BY meal_date ASC;
  `, [userId(rawUserId), startDate, endDate]);
  return result.rows;
}

export async function setTargets(rawUserId, goals) {
  await query(`
    UPDATE users SET calorie_goal = $2, protein_goal_g = $3, carbs_goal_g = $4, fat_goal_g = $5, sugar_goal_g = $6, fiber_goal_g = $7
    WHERE telegram_user_id = $1;
  `, [userId(rawUserId), goals.calorie_goal, goals.protein_goal_g, goals.carbs_goal_g, goals.fat_goal_g, goals.sugar_goal_g, goals.fiber_goal_g]);
}

export async function saveWeight({ userId: rawUserId, date, weightLb }) {
  await query(`
    INSERT INTO weights (telegram_user_id, weight_date, weight_lb)
    VALUES ($1, $2, $3)
    ON CONFLICT (telegram_user_id, weight_date)
    DO UPDATE SET weight_lb = EXCLUDED.weight_lb, created_at = now();
  `, [userId(rawUserId), date, weightLb]);
}

export async function getWeights(rawUserId, limit = 14) {
  const result = await query(`
    SELECT weight_date::text AS date, weight_lb
    FROM weights
    WHERE telegram_user_id = $1
    ORDER BY weight_date DESC
    LIMIT $2;
  `, [userId(rawUserId), limit]);
  return result.rows;
}

export async function exportMealRows(rawUserId) {
  const result = await query(`
    SELECT id AS meal_id, meal_date::text AS date, meal_type, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, raw_message, created_at::text AS created_at
    FROM meals
    WHERE telegram_user_id = $1
    ORDER BY meal_date ASC, created_at ASC;
  `, [userId(rawUserId)]);
  return result.rows;
}
