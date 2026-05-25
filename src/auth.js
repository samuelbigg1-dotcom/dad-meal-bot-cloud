import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { getUser, upsertUser } from "./db.js";

function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL);
}

export function setupAuth(app) {
  const sessionSecret = process.env.SESSION_SECRET || process.env.COOKIE_SECRET || process.env.WEB_PIN || "dev-session-secret-change-me";

  app.set("trust proxy", 1);
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user.telegram_user_id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await getUser(id);
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  if (googleAuthConfigured()) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || "";
        const avatarUrl = profile.photos?.[0]?.value || "";
        const userId = `google:${profile.id}`;
        await upsertUser({
          userId,
          firstName: profile.name?.givenName || profile.displayName || email || "User",
          timezone: process.env.TIMEZONE || "America/Vancouver",
          email,
          googleId: profile.id,
          avatarUrl
        });
        const user = await getUser(userId);
        done(null, user);
      } catch (error) {
        done(error);
      }
    }));

    app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
    app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), (req, res) => {
      res.redirect("/");
    });
  }

  app.get("/logout", (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session?.destroy(() => res.redirect("/login"));
    });
  });
}

export function hasGoogleAuth() {
  return googleAuthConfigured();
}

export function loggedInUserId(req) {
  return req.user?.telegram_user_id || null;
}
