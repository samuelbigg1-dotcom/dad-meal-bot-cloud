import { escapeHtml, round0, round1, macroGoalsFromUser, clamp } from "./utils.js";

const settingsIcon = `<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6z"></path></svg></span>`;
const assistantIcon = `<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 18.5 4 21v-4.6A7.5 7.5 0 0 1 2.5 12c0-4.4 4-8 9-8h1c5 0 9 3.6 9 8s-4 8-9 8h-5z"></path><path d="M8 11h8"></path><path d="M8 14h5"></path></svg></span>`;
const ASSET_VERSION = "home-stats-v2";

export function layout({ title = "Macro Tracker", active = "", body = "", user = null }) {
  const nav = [
    ["foods", "/foods", "Foods"],
    ["log", "/log", "Log"],
    ["dashboard", "/", "Home"],
    ["recommend", "/recommendations", "Meals"],
    ["history", "/history", "Progress"]
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <script>try{document.documentElement.dataset.theme=localStorage.getItem("dadMealTheme")||"light";}catch(e){document.documentElement.dataset.theme="light";}</script>
  <link rel="stylesheet" href="/public/app.css?v=warm-dark-rework-v1" />
  <link rel="stylesheet" href="/public/compact.css?v=${ASSET_VERSION}" />
  <link rel="stylesheet" href="/public/assistant.css?v=${ASSET_VERSION}" />
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <div class="eyebrow">Daily Macro Coach</div>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <div class="topbar-actions icon-actions">
        <button class="icon-button theme-toggle" type="button" data-theme-toggle aria-label="Switch theme"><span class="icon-svg" data-theme-toggle-icon></span></button>
        ${user ? `<a class="icon-button" href="/settings" aria-label="Settings" title="Settings">${settingsIcon}</a><button class="icon-button" type="button" data-assistant-open aria-label="Assistant" title="Assistant">${assistantIcon}</button>` : ""}
      </div>
    </header>

    <main class="content">${body}</main>

    <nav class="bottom-nav">
      ${nav.map(([key, href, label]) => `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
    </nav>
  </div>
  <script src="/public/theme.js?v=${ASSET_VERSION}"></script>
  <script src="/public/app.js?v=editable-confirm-v6"></script>
  <script src="/public/ui-compact.js?v=${ASSET_VERSION}"></script>
  <script src="/public/today-polish.js?v=${ASSET_VERSION}"></script>
  <script src="/public/today-dashboard.js?v=home-scan-restored-v2"></script>
  <script src="/public/today-dashboard-fix.js?v=${ASSET_VERSION}"></script>
  <script src="/public/home-cleanup.js?v=${ASSET_VERSION}"></script>
  <script src="/public/scan-overlay-guard.js?v=${ASSET_VERSION}"></script>
  <script src="/public/foods-sections.js?v=custom-food-route-fix-v2"></script>
  <script src="/public/serving-display-polish.js?v=${ASSET_VERSION}"></script>
  <script src="/public/settings-polish.js?v=${ASSET_VERSION}"></script>
  <script src="/public/log-auto-meal.js?v=${ASSET_VERSION}"></script>
  <script src="/public/recommendations-polish.js?v=${ASSET_VERSION}"></script>
  <script src="/public/history-review.js?v=${ASSET_VERSION}"></script>
  <script src="/public/progress-polish.js?v=progress-polish-v1"></script>
  <script src="/public/nav-restore.js?v=nav-restore-v1"></script>
  <script src="/public/home-weight-reminder-fix.js?v=home-weight-reminder-fix-v1"></script>
  <script src="/public/health-score.js?v=health-score-v1"></script>
  <script src="/public/assistant.js?v=${ASSET_VERSION}"></script>
</body>
</html>`;
}

export function macroCards(totals, user) {
  const goals = macroGoalsFromUser(user);
  const rows = [["Calories", "calories", "", true], ["Protein", "protein_g", "g", false], ["Carbs", "carbs_g", "g", false], ["Fat", "fat_g", "g", false], ["Sugar", "sugar_g", "g", false], ["Fiber", "fiber_g", "g", false]];
  const data = rows.map(([label, key, unit, whole]) => {
    const current = Number(totals[key] || 0);
    const goal = Number(goals[key] || 1);
    const left = goal - current;
    const percent = clamp((current / goal) * 100, 0, 140);
    return {
      label,
      key,
      unit,
      current: whole ? round0(current) : round1(current),
      goal: whole ? round0(goal) : round1(goal),
      left: whole ? round0(Math.abs(left)) : round1(Math.abs(left)),
      over: left < 0,
      percent: round0(percent)
    };
  });
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/json" id="home-macro-data">${json}</script>`;
}

export function mealList(meals = []) {
  if (!meals.length) return `<div class="empty">No meals logged for this day.</div>`;
  return `<div class="list meal-group-list">
    ${meals.map((m) => `<a class="list-row meal-row-compact" href="/history?date=${escapeHtml(String(m.meal_date || "").slice(0, 10))}">
      <div><strong>${escapeHtml(m.meal_type || "meal")}</strong><p>${escapeHtml(m.raw_message || "")}</p></div>
      <div class="cal">${round0(m.calories)} cal</div>
    </a>`).join("")}
  </div>`;
}

export function totalsLine(totals) {
  return `<div class="totals-pill">
    <span>${round0(totals.calories)} cal</span><span>P ${round1(totals.protein_g)}g</span><span>C ${round1(totals.carbs_g)}g</span><span>F ${round1(totals.fat_g)}g</span><span>Sug ${round1(totals.sugar_g)}g</span><span>Fib ${round1(totals.fiber_g)}g</span>
  </div>`;
}

export function flash(message, type = "info") {
  if (!message) return "";
  return `<div class="flash ${type}">${escapeHtml(message)}</div>`;
}