import express from "express";

import { hasGoogleAuth, loggedInUserId, setupAuth } from "./auth.js";
import { runWithUserId } from "./userContext.js";
import { query } from "./db.js";
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
  return path === "/onboarding" || path === "/check-in" || path === "/logout" || path === "/settings/reset-onboarding";
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
