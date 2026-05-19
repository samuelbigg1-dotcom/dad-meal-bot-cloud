import { escapeHtml, round0, round1, macroGoalsFromUser, clamp } from "./utils.js";

export function layout({ title = "Dad Meal Tracker", active = "", body = "", user = null }) {
  const nav = [
    ["dashboard", "/", "Today"],
    ["log", "/log", "Log"],
    ["recommend", "/recommendations", "Recommend"],
    ["history", "/history", "History"],
    ["foods", "/foods", "Foods"],
    ["settings", "/settings", "Settings"]
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/public/app.css" />
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <div class="eyebrow">Macro tracker</div>
        <h1>${escapeHtml(title)}</h1>
      </div>
      ${user ? `<a class="small-link" href="/logout">Logout</a>` : ""}
    </header>

    <main class="content">
      ${body}
    </main>

    <nav class="bottom-nav">
      ${nav.map(([key, href, label]) => `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
    </nav>
  </div>
  <script src="/public/app.js?v=label-confirm-v2"></script>
</body>
</html>`;
}

export function macroCards(totals, user) {
  const goals = macroGoalsFromUser(user);
  const rows = [
    ["Calories", "calories", "", true],
    ["Protein", "protein_g", "g", false],
    ["Carbs", "carbs_g", "g", false],
    ["Fat", "fat_g", "g", false],
    ["Sugar", "sugar_g", "g", false],
    ["Fiber", "fiber_g", "g", false]
  ];

  return `<div class="macro-grid">
    ${rows.map(([label, key, unit, whole]) => {
      const val = Number(totals[key] || 0);
      const goal = Number(goals[key] || 1);
      const pct = clamp((val / goal) * 100, 0, 140);
      const status = pct > 105 ? "over" : pct > 90 ? "near" : pct < 60 ? "low" : "ok";
      const left = goal - val;
      const displayVal = whole ? round0(val) : round1(val);
      const displayGoal = whole ? round0(goal) : round1(goal);
      const displayLeft = whole ? round0(Math.abs(left)) : round1(Math.abs(left));
      return `<section class="macro-card ${status}">
        <div class="macro-head">
          <span>${label}</span>
          <strong>${round0((val / goal) * 100)}%</strong>
        </div>
        <div class="bar"><span style="width:${Math.min(pct, 100)}%"></span></div>
        <div class="macro-values">
          <span>${displayVal}${unit} / ${displayGoal}${unit}</span>
          <span>${displayLeft}${unit} ${left >= 0 ? "left" : "over"}</span>
        </div>
      </section>`;
    }).join("")}
  </div>`;
}

export function mealList(meals = []) {
  if (!meals.length) return `<div class="empty">No meals logged yet today.</div>`;
  return `<div class="list">
    ${meals.map((m) => `<div class="list-row">
      <div>
        <strong>${escapeHtml(m.meal_type || "meal")}</strong>
        <p>${escapeHtml(m.raw_message || "")}</p>
      </div>
      <div class="cal">${round0(m.calories)} cal</div>
    </div>`).join("")}
  </div>`;
}

export function totalsLine(totals) {
  return `<div class="totals-pill">
    <span>${round0(totals.calories)} cal</span>
    <span>P ${round1(totals.protein_g)}g</span>
    <span>C ${round1(totals.carbs_g)}g</span>
    <span>F ${round1(totals.fat_g)}g</span>
    <span>Sug ${round1(totals.sugar_g)}g</span>
    <span>Fib ${round1(totals.fiber_g)}g</span>
  </div>`;
}

export function flash(message, type = "info") {
  if (!message) return "";
  return `<div class="flash ${type}">${escapeHtml(message)}</div>`;
}
