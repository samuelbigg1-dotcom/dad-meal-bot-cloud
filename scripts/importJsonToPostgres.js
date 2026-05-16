import "dotenv/config";
import fs from "fs/promises";
import { initDb, addFood, upsertUser, query } from "../src/db.js";

const jsonPath = "./data/meals.json";

async function main() {
  await initDb();

  const raw = await fs.readFile(jsonPath, "utf8");
  const db = JSON.parse(raw);

  for (const food of db.foods || []) {
    await addFood(food);
  }

  for (const user of db.users || []) {
    await upsertUser({
      telegramUserId: user.telegram_user_id,
      firstName: user.first_name,
      timezone: user.timezone || process.env.TIMEZONE || "America/Vancouver"
    });

    await query(`
      UPDATE users SET
        calorie_goal = $2,
        protein_goal_g = $3,
        carbs_goal_g = $4,
        fat_goal_g = $5,
        sugar_goal_g = $6,
        fiber_goal_g = $7
      WHERE telegram_user_id = $1;
    `, [
      user.telegram_user_id,
      user.calorie_goal || 2600,
      user.protein_goal_g || 175,
      user.carbs_goal_g || 305,
      user.fat_goal_g || 70,
      user.sugar_goal_g || 65,
      user.fiber_goal_g || 35
    ]);
  }

  for (const meal of db.meals || []) {
    const mealResult = await query(`
      INSERT INTO meals
        (telegram_user_id, meal_date, meal_type, raw_message, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, created_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id;
    `, [
      meal.telegram_user_id,
      meal.meal_date,
      meal.meal_type || "meal",
      meal.raw_message || "",
      meal.calories || 0,
      meal.protein_g || 0,
      meal.carbs_g || 0,
      meal.fat_g || 0,
      meal.sugar_g || 0,
      meal.fiber_g || 0,
      meal.created_at || new Date().toISOString()
    ]);

    const newMealId = mealResult.rows[0].id;
    const items = (db.meal_items || []).filter((item) => item.meal_id === meal.id);

    for (const item of items) {
      await query(`
        INSERT INTO meal_items
          (meal_id, food_name, matched_food_id, quantity, unit, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, confidence, note)
        VALUES
          ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12);
      `, [
        newMealId,
        item.food_name,
        item.quantity || 1,
        item.unit || "serving",
        item.calories || 0,
        item.protein_g || 0,
        item.carbs_g || 0,
        item.fat_g || 0,
        item.sugar_g || 0,
        item.fiber_g || 0,
        item.confidence || "medium",
        item.note || null
      ]);
    }
  }

  for (const weight of db.weights || []) {
    await query(`
      INSERT INTO weights (telegram_user_id, weight_date, weight_lb, created_at)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (telegram_user_id, weight_date)
      DO UPDATE SET weight_lb = EXCLUDED.weight_lb;
    `, [
      weight.telegram_user_id,
      weight.date,
      weight.weight_lb,
      weight.created_at || new Date().toISOString()
    ]);
  }

  console.log("Imported local JSON data into PostgreSQL.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
