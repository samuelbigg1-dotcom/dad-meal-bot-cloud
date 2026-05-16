import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { Telegraf } from "telegraf";
import {
  addFood,
  deleteLastMeal,
  exportMealRows,
  getDailyTotals,
  getFoods,
  getLastMealWithItems,
  getMealsForDate,
  getUser,
  getWeeklyTotals,
  getWeights,
  initDb,
  replaceLastMeal,
  saveMeal,
  saveWeight,
  setTargets,
  upsertUser
} from "./db.js";
import { parseEditedMealWithAI, parseMealWithAI } from "./aiParser.js";
import { calculateItems, totalItems } from "./nutrition.js";
import { addDays, csvEscape, todayInTimezone } from "./utils.js";
import { formatLoggedMeal, formatTotals, helpMessage } from "./messages.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const timezone = process.env.TIMEZONE || "America/Vancouver";
const allowedTelegramUserId = process.env.ALLOWED_TELEGRAM_USER_ID || "";

if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");

const bot = new Telegraf(token);

function telegramUserId(ctx) {
  return String(ctx.from?.id || "");
}

function isAllowed(ctx) {
  if (!allowedTelegramUserId) return true;
  return telegramUserId(ctx) === String(allowedTelegramUserId);
}

async function ensureUser(ctx) {
  const id = telegramUserId(ctx);
  await upsertUser({ telegramUserId: id, firstName: ctx.from?.first_name || null, timezone });
  return getUser(id);
}

function guardAllowed(ctx) {
  if (!isAllowed(ctx)) {
    ctx.reply("This private meal tracker is not set up for your Telegram account.");
    return false;
  }
  return true;
}

function average(rows, key) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length;
}

bot.start(async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  await ctx.reply([
    "Meal tracker is ready.",
    "",
    `Your Telegram ID is: ${telegramUserId(ctx)}`,
    "",
    "Try:",
    "smoothie",
    "",
    "Use /help for commands."
  ].join("\n"));
});

bot.help(async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  await ctx.reply(helpMessage());
});

bot.command("today", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  const user = await ensureUser(ctx);
  const date = todayInTimezone(user.timezone || timezone);
  const totals = await getDailyTotals(telegramUserId(ctx), date);
  const meals = await getMealsForDate(telegramUserId(ctx), date);
  const mealLines = meals.length
    ? meals.map((m) => `- ${m.meal_type}: ${Math.round(Number(m.calories))} cal`).join("\n")
    : "No meals logged yet today.";
  await ctx.reply([formatTotals(`Today (${date}):`, totals, user, true), "", mealLines].join("\n"));
});

bot.command("week", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  const user = await ensureUser(ctx);
  const end = new Date();
  const start = addDays(end, -6);
  const startDate = todayInTimezone(user.timezone || timezone, start);
  const endDate = todayInTimezone(user.timezone || timezone, end);
  const rows = await getWeeklyTotals(telegramUserId(ctx), startDate, endDate);
  const weights = await getWeights(telegramUserId(ctx), 7);

  if (!rows.length) {
    await ctx.reply("No meals logged in the last 7 days.");
    return;
  }

  const lines = rows.map((r) => `${r.meal_date}: ${Math.round(Number(r.calories))} cal, P ${Number(r.protein_g).toFixed(1)}g, C ${Number(r.carbs_g).toFixed(1)}g, F ${Number(r.fat_g).toFixed(1)}g`);
  const avgLines = [
    "",
    "Averages from logged days:",
    `Calories: ${Math.round(average(rows, "calories"))}`,
    `Protein: ${average(rows, "protein_g").toFixed(1)}g`,
    `Carbs: ${average(rows, "carbs_g").toFixed(1)}g`,
    `Fat: ${average(rows, "fat_g").toFixed(1)}g`
  ];

  if (weights.length) {
    const avgWeight = weights.reduce((sum, w) => sum + Number(w.weight_lb || 0), 0) / weights.length;
    avgLines.push(`Weight avg: ${avgWeight.toFixed(1)} lb`);
  }

  await ctx.reply(["Last 7 days:", "", ...lines, ...avgLines].join("\n"));
});

bot.command("foods", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  const foods = await getFoods();
  const lines = foods.map((f) => {
    const qty = Number(f.base_qty).toFixed(3).replace(/\.?0+$/, "");
    return `- ${f.name}: ${qty} ${f.base_unit}, ${Math.round(Number(f.calories))} cal, P ${Number(f.protein_g).toFixed(1)}g C ${Number(f.carbs_g).toFixed(1)}g F ${Number(f.fat_g).toFixed(1)}g`;
  });
  await ctx.reply(["Saved foods:", "", ...lines].join("\n").slice(0, 3900));
});

bot.command("delete_last", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  const deleted = await deleteLastMeal(telegramUserId(ctx));
  if (!deleted) {
    await ctx.reply("Nothing to delete yet.");
    return;
  }
  await ctx.reply(`Deleted last meal: ${deleted.meal_type}, ${Math.round(Number(deleted.calories))} cal.`);
});

bot.command("edit_last", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  const user = await ensureUser(ctx);
  const correction = ctx.message.text.replace(/^\/edit_last(@\w+)?\s*/i, "").trim();

  if (!correction) {
    await ctx.reply("Use it like:\n/edit_last rice was 1.5 cups not 1 cup\n\nOr replace the full meal:\n/edit_last dinner 8 oz chicken, 1 cup rice, broccoli");
    return;
  }

  const last = await getLastMealWithItems(telegramUserId(ctx));
  if (!last) {
    await ctx.reply("No last meal to edit yet.");
    return;
  }

  await ctx.sendChatAction("typing");

  try {
    const foods = await getFoods();
    const parsedMeal = await parseEditedMealWithAI({ previousRawMessage: last.meal.raw_message, previousItems: last.items, editInstruction: correction });
    const items = calculateItems(parsedMeal, foods);
    const mealTotals = totalItems(items);

    await replaceLastMeal({
      telegramUserId: telegramUserId(ctx),
      mealDate: last.meal.meal_date,
      mealType: parsedMeal.meal_type || last.meal.meal_type || "meal",
      rawMessage: `${last.meal.raw_message}\nEDIT: ${correction}`,
      totals: mealTotals,
      items
    });

    const dailyTotals = await getDailyTotals(telegramUserId(ctx), last.meal.meal_date);
    await ctx.reply(formatLoggedMeal({ items, mealTotals, dailyTotals, user, edited: true }));
  } catch (error) {
    console.error(error);
    await ctx.reply(`I couldn't edit that meal. Error: ${error.message}`);
  }
});

bot.command("weight", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  const user = await ensureUser(ctx);
  const raw = ctx.message.text.replace(/^\/weight(@\w+)?\s*/i, "").trim();
  const match = raw.match(/(\d+(\.\d+)?)/);
  if (!match) {
    await ctx.reply("Use: /weight 170.4");
    return;
  }
  const weightLb = Number(match[1]);
  const date = todayInTimezone(user.timezone || timezone);
  await saveWeight({ telegramUserId: telegramUserId(ctx), date, weightLb });
  const weights = await getWeights(telegramUserId(ctx), 7);
  const avgWeight = weights.reduce((sum, w) => sum + Number(w.weight_lb || 0), 0) / weights.length;
  await ctx.reply(`Saved weight: ${weightLb.toFixed(1)} lb\n7-entry average: ${avgWeight.toFixed(1)} lb`);
});

bot.command("weights", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  const weights = await getWeights(telegramUserId(ctx), 14);
  if (!weights.length) {
    await ctx.reply("No weights logged yet. Use /weight 170.4");
    return;
  }
  const lines = weights.map((w) => `- ${w.date}: ${Number(w.weight_lb).toFixed(1)} lb`);
  await ctx.reply(["Recent weights:", "", ...lines].join("\n"));
});

bot.command("settargets", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  const parts = ctx.message.text.split(/\s+/).slice(1).map(Number);
  if (parts.length !== 6 || parts.some((n) => !Number.isFinite(n))) {
    await ctx.reply("Use: /settargets calories protein carbs fat sugar fiber\nExample: /settargets 2600 175 305 70 65 35");
    return;
  }
  const [calories, protein, carbs, fat, sugar, fiber] = parts;
  await setTargets(telegramUserId(ctx), { calorie_goal: calories, protein_goal_g: protein, carbs_goal_g: carbs, fat_goal_g: fat, sugar_goal_g: sugar, fiber_goal_g: fiber });
  await ctx.reply("Targets updated.");
});

bot.command("addfood", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  const raw = ctx.message.text.replace(/^\/addfood(@\w+)?\s*/i, "").trim();
  const parts = raw.split("|").map((x) => x.trim());
  if (parts.length < 9) {
    await ctx.reply(["Use:", "/addfood name | base qty | unit | cal | protein | carbs | fat | sugar | fiber | aliases", "", "Example:", "/addfood banana | 1 | medium | 105 | 1.3 | 27 | 0.4 | 14 | 3 | bananas"].join("\n"));
    return;
  }
  const [name, baseQty, unit, calories, protein, carbs, fat, sugar, fiber, aliasesRaw = ""] = parts;
  const nums = [baseQty, calories, protein, carbs, fat, sugar, fiber].map(Number);
  if (!name || nums.some((n) => !Number.isFinite(n))) {
    await ctx.reply("That food format had a number problem. Check the example in /help.");
    return;
  }
  const aliases = aliasesRaw.split(",").map((x) => x.trim()).filter(Boolean);
  await addFood({ name, aliases, base_qty: nums[0], base_unit: unit, calories: nums[1], protein_g: nums[2], carbs_g: nums[3], fat_g: nums[4], sugar_g: nums[5], fiber_g: nums[6] });
  await ctx.reply(`Saved food: ${name}`);
});

bot.command("export", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  await ensureUser(ctx);
  const rows = await exportMealRows(telegramUserId(ctx));
  if (!rows.length) {
    await ctx.reply("No meals to export yet.");
    return;
  }
  const headers = ["date", "meal_type", "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "raw_message", "created_at"];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
  const outDir = "/tmp";
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `meal-export-${telegramUserId(ctx)}.csv`);
  await fs.writeFile(outPath, csv, "utf8");
  await ctx.replyWithDocument({ source: outPath, filename: "meal-export.csv" });
});

bot.on("text", async (ctx) => {
  if (!guardAllowed(ctx)) return;
  const user = await ensureUser(ctx);
  const rawMessage = ctx.message.text;
  const date = todayInTimezone(user.timezone || timezone);
  await ctx.sendChatAction("typing");

  try {
    const foods = await getFoods();
    const parsedMeal = await parseMealWithAI(rawMessage);
    const items = calculateItems(parsedMeal, foods);
    const mealTotals = totalItems(items);
    await saveMeal({ telegramUserId: telegramUserId(ctx), mealDate: date, mealType: parsedMeal.meal_type || "meal", rawMessage, totals: mealTotals, items });
    const dailyTotals = await getDailyTotals(telegramUserId(ctx), date);
    await ctx.reply(formatLoggedMeal({ items, mealTotals, dailyTotals, user }));
  } catch (error) {
    console.error(error);
    await ctx.reply(["I couldn't log that meal.", "Try writing it like:", "breakfast: 3 eggs, 2 slices toast, 1 tbsp butter", "", `Error: ${error.message}`].join("\n"));
  }
});

async function main() {
  await initDb();
  await bot.telegram.setMyCommands([
    { command: "today", description: "Show today's totals and remaining macros" },
    { command: "week", description: "Show last 7 days and averages" },
    { command: "foods", description: "Show saved foods" },
    { command: "delete_last", description: "Delete last meal" },
    { command: "edit_last", description: "Edit the last meal" },
    { command: "weight", description: "Log body weight" },
    { command: "weights", description: "Show recent weights" },
    { command: "export", description: "Export meals to CSV" },
    { command: "settargets", description: "Set calorie/macro goals" },
    { command: "addfood", description: "Add a known food" },
    { command: "help", description: "Show help" }
  ]);
  bot.launch();
  console.log("Dad meal bot V2 is running.");
  console.log(`Saving data to: ${process.env.DB_FILE || "./data/meals.json"}`);
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
