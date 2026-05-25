import express from "express";

import { hasGoogleAuth, loggedInUserId, setupAuth } from "./auth.js";
import { runWithUserId } from "./userContext.js";

const originalUse = express.application.use;
const installedApps = new WeakSet();
let installing = false;

function isPublicPath(req) {
  const path = req.path || req.url || "/";
  return path === "/login" || path === "/favicon.ico" || path.startsWith("/auth/") || path.startsWith("/public/");
}

function installAuthOnce(app) {
  if (installedApps.has(app) || installing) return;
  installedApps.add(app);
  installing = true;

  const patchedUse = express.application.use;
  express.application.use = originalUse;
  setupAuth(app);

  originalUse.call(app, (req, res, next) => {
    if (hasGoogleAuth() && !isPublicPath(req) && !req.user) {
      return res.redirect("/login");
    }

    const userId = loggedInUserId(req);
    if (userId) {
      return runWithUserId(userId, () => next());
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
