import express from "express";

import { hasGoogleAuth, loggedInUserId, setupAuth } from "./auth.js";
import { runWithUserId } from "./userContext.js";
import { getUser, query } from "./db.js";
import { getRecommendedMeals } from "./recommendedMeals.js";
import { checkInDue, ensureOnboardingSchema, needsOnboarding, saveCheckIn, saveOnboarding, showCheckIn, showOnboarding } from "./onboarding.js";

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  // Google login replaces the old shared PIN gate. SESSION_SECRET still protects the signed session cookie.
  process.env.WEB_PIN = "";
}

const originalUse = express.application.use;
const installedApps = new WeakSet();
let installing = false;

function pathOf(req) {
  return req.path || req.url || "/";
}

function isPublicPath(req) {
  const path = pathOf(req);
  return path === "/login" || path === "/favicon.ico" || path.startsWith("/auth/") || path.startsWith("/public/");
}

function isSetupPath(req) {
  const path = pathOf(req);
  return path === "/onboarding" || path === "/check-in" || path === "/logout" || path === "/settings/reset-onboarding" || path === "/settings/profile.json";
}

function labelize(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function heightText(heightCm) {
  const cm = Number(heightCm || 0);
  if (!cm) return "Not set";
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}`;
}

async function resetOnboardingForUser(userId) {
  await ensureOnboardingSchema();
  await query(`
    UPDATE users SET
      onboarding_complete = false,
      goal_type = '',
      goal_pace = '',
      activity_level = '',
      eating_pattern = '',
      height_cm = NULL,
      starting_weight_lb = NULL,
      birth_age = NULL,
      sex_for_formula = '',
      onboarded_at = NULL,
      last_checkin_at = NULL,
      last_checkin_weight_lb = NULL
    WHERE telegram_user_id = $1
  `, [userId]);
}

function installAuthOnce(app) {
  if (installedApps.has(app) || installing) return;
  installedApps.add(app);
  installing = true;

  const patchedUse = express.application.use;
  express.application.use = originalUse;
  setupAuth(app);

  app.get("/onboarding", (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    return runWithUserId(loggedInUserId(req), () => showOnboarding(req, res).catch(next));
  });
  app.post("/onboarding", express.urlencoded({ extended: true, limit: "64kb" }), (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    return runWithUserId(loggedInUserId(req), () => saveOnboarding(req, res).catch(next));
  });
  app.get("/check-in", (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    return runWithUserId(loggedInUserId(req), () => showCheckIn(req, res).catch(next));
  });
  app.post("/check-in", express.urlencoded({ extended: true, limit: "64kb" }), (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    return runWithUserId(loggedInUserId(req), () => saveCheckIn(req, res).catch(next));
  });
  app.get("/settings/profile.json", (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not signed in" });
    const userId = loggedInUserId(req);
    return runWithUserId(userId, async () => {
      await ensureOnboardingSchema();
      const user = await getUser(userId);
      const recommendedMeals = await getRecommendedMeals(userId);
      res.json({
        email: user?.email || "",
        name: user?.first_name || "",
        plan: {
          goal: labelize(user?.goal_type || "Not set"),
          pace: labelize(user?.goal_pace || "Not set"),
          activity: labelize(user?.activity_level || "Not set"),
          eatingStyle: labelize(user?.eating_pattern || "Not set"),
          mealRoutine: recommendedMeals.map(labelize).join(", "),
          height: heightText(user?.height_cm),
          startingWeight: user?.starting_weight_lb ? `${Number(user.starting_weight_lb).toFixed(1)} lb` : "Not set",
          age: user?.birth_age ? String(Math.round(Number(user.birth_age))) : "Not set"
        },
        targets: {
          calories: Math.round(Number(user?.calorie_goal || 0)),
          protein: Math.round(Number(user?.protein_goal_g || 0)),
          carbs: Math.round(Number(user?.carbs_goal_g || 0)),
          fat: Math.round(Number(user?.fat_goal_g || 0)),
          sugar: Math.round(Number(user?.sugar_goal_g || 0)),
          fiber: Math.round(Number(user?.fiber_goal_g || 0))
        }
      });
    }).catch(next);
  });
  app.post("/settings/reset-onboarding", express.urlencoded({ extended: true, limit: "64kb" }), (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    const userId = loggedInUserId(req);
    return runWithUserId(userId, async () => {
      await resetOnboardingForUser(userId);
      res.redirect("/onboarding");
    }).catch(next);
  });

  originalUse.call(app, async (req, res, next) => {
    if (hasGoogleAuth() && !isPublicPath(req) && !req.user) {
      return res.redirect("/login");
    }

    const userId = loggedInUserId(req);
    if (userId) {
      return runWithUserId(userId, async () => {
        if (hasGoogleAuth() && !isSetupPath(req) && await needsOnboarding(userId)) {
          return res.redirect("/onboarding");
        }
        if (hasGoogleAuth() && !isSetupPath(req) && await checkInDue(userId)) {
          return res.redirect("/check-in");
        }
        return next();
      });
    }

    return next();
  });

  express.application.use = patchedUse;
  installing = false;
}

express.application.use = function patchedUse(...args) {
  installAuthOnce(this);
  return originalUse.apply(this, args);
};
