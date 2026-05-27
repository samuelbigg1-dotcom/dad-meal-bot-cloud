(function () {
  function injectStyles() {
    if (document.getElementById("settings-polish-style")) return;
    const style = document.createElement("style");
    style.id = "settings-polish-style";
    style.textContent = `
      .settings-done-row { display:flex; justify-content:flex-end; margin:-6px 0 12px; }
      .settings-done-button { min-width:104px; justify-content:center; border-radius:999px; background:var(--accent); color:#1a100c; font-weight:950; }
      .settings-plan-grid, .settings-target-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:14px; }
      .settings-tile { border:1px solid var(--line); border-radius:18px; padding:12px; background:var(--card2); }
      .settings-tile span { display:block; color:var(--muted); font-size:11px; font-weight:950; text-transform:uppercase; letter-spacing:.12em; margin-bottom:5px; }
      .settings-tile strong { font-size:18px; line-height:1.2; }
      .settings-target-grid .settings-tile strong { font-size:24px; letter-spacing:-.03em; }
      .account-pill { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--line); border-radius:22px; background:var(--card2); padding:13px 14px; margin-top:14px; }
      .account-pill span { color:var(--muted); font-size:12px; font-weight:950; letter-spacing:.1em; text-transform:uppercase; }
      .account-pill strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .advanced-macro-settings summary { cursor:pointer; font-weight:950; font-size:18px; list-style:none; }
      .advanced-macro-settings summary::-webkit-details-marker { display:none; }
      .advanced-macro-settings summary::after { content:'Show'; float:right; color:var(--muted); font-size:13px; margin-top:4px; }
      .advanced-macro-settings[open] summary::after { content:'Hide'; }
      .reset-setup-card form, .account-card .action-row { margin-top:12px; }
      .reset-setup-card .button.danger-soft { background:rgba(218,90,72,.12); border-color:rgba(218,90,72,.28); color:#ffb7aa; }
      .settings-hidden-original { display:none !important; }
      @media (max-width: 560px) { .settings-plan-grid, .settings-target-grid { grid-template-columns:1fr; } .settings-done-row { justify-content:stretch; } .settings-done-button { width:100%; } }
    `;
    document.head.appendChild(style);
  }

  function macroForm() { return document.querySelector("form[action='/settings']"); }
  function val(name) { return macroForm()?.querySelector(`[name='${name}']`)?.value || "—"; }
  function tile(label, value) { return `<div class="settings-tile"><span>${label}</span><strong>${value || "Not set"}</strong></div>`; }

  function targetsFromForm() {
    return {
      calories: val("calories"),
      protein: val("protein"),
      carbs: val("carbs"),
      fat: val("fat"),
      sugar: val("sugar"),
      fiber: val("fiber")
    };
  }

  async function getProfile() {
    try {
      const response = await fetch("/settings/profile.json", { credentials: "same-origin" });
      if (!response.ok) throw new Error("profile unavailable");
      return await response.json();
    } catch (error) {
      return { email: "", name: "", plan: {}, targets: targetsFromForm() };
    }
  }

  function headingText(el) {
    return (el.querySelector("h2, summary")?.textContent || "").replace(/show|hide/ig, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function addDoneButton(content) {
    if (!content || document.querySelector(".settings-done-row")) return;
    const row = document.createElement("div");
    row.className = "settings-done-row settings-rebuilt";
    row.innerHTML = `<a class="button settings-done-button" href="/">Done</a>`;
    content.prepend(row);
  }

  function removeDuplicateSettingsCards() {
    const seen = new Set();
    const duplicateKeys = ["my plan", "daily targets", "redo setup", "advanced manual macro edit", "meal routine"];
    const cards = [...document.querySelectorAll("section.card, details.card")];
    for (const card of cards) {
      const key = headingText(card);
      if (!duplicateKeys.includes(key)) continue;
      const hasForm = Boolean(card.querySelector("form[action='/settings']"));
      const isRebuiltAdvanced = key === "advanced manual macro edit" && card.classList.contains("settings-rebuilt") && hasForm;
      const keepKey = key === "advanced manual macro edit" ? "advanced manual macro edit" : key;
      if (seen.has(keepKey)) {
        card.remove();
        continue;
      }
      if (key === "meal routine") {
        card.remove();
        continue;
      }
      if (key === "advanced manual macro edit" && !isRebuiltAdvanced && document.querySelector(".advanced-macro-settings.settings-rebuilt")) {
        card.remove();
        continue;
      }
      seen.add(keepKey);
    }
  }

  async function rebuildSettings() {
    const title = document.querySelector("h1")?.textContent?.trim().toLowerCase();
    if (title !== "settings") return;
    injectStyles();
    const content = document.querySelector(".content");
    addDoneButton(content);
    removeDuplicateSettingsCards();
    if (document.querySelector(".settings-plan-card.settings-rebuilt") && document.querySelector(".settings-target-card.settings-rebuilt")) return;

    const form = macroForm();
    if (!content || !form) return;

    const profile = await getProfile();
    const plan = profile.plan || {};
    const targets = { ...targetsFromForm(), ...(profile.targets || {}) };
    const originalMealCard = document.querySelector(".recommended-meals-card");
    const originalFormCard = form.closest("section.card");
    [...content.querySelectorAll("section.card")].forEach((card) => card.classList.add("settings-hidden-original"));

    const planCard = document.createElement("section");
    planCard.className = "card compact-card settings-rebuilt settings-plan-card";
    planCard.innerHTML = `<h2>My plan</h2><p class="muted">This is the setup your targets and meal ideas are based on.</p><div class="account-pill"><div><span>Signed in as</span><strong>${profile.email || profile.name || "Google account"}</strong></div><a class="button" href="/logout">Log out</a></div><div class="settings-plan-grid">${tile("Goal", plan.goal)}${tile("Pace", plan.pace)}${tile("Activity", plan.activity)}${tile("Eating style", plan.eatingStyle)}${tile("Meal routine", plan.mealRoutine)}${tile("Height", plan.height)}${tile("Starting weight", plan.startingWeight)}${tile("Age", plan.age)}</div>`;

    const targetCard = document.createElement("section");
    targetCard.className = "card compact-card settings-rebuilt settings-target-card";
    targetCard.innerHTML = `<h2>Daily targets</h2><p class="muted">Generated from your setup. These are the numbers the dashboard and meal ideas use.</p><div class="settings-target-grid">${tile("Calories", targets.calories)}${tile("Protein", `${targets.protein}g`)}${tile("Carbs", `${targets.carbs}g`)}${tile("Fat", `${targets.fat}g`)}${tile("Sugar", `under ${targets.sugar}g`)}${tile("Fiber", `${targets.fiber}g`)}</div>`;

    const resetCard = document.createElement("section");
    resetCard.className = "card compact-card settings-rebuilt reset-setup-card";
    resetCard.innerHTML = `<h2>Redo setup</h2><p class="muted">Run the startup wizard again if the goal, height, weight, activity, eating style, or meal routine needs to change.</p><form method="post" action="/settings/reset-onboarding" onsubmit="return confirm('Redo setup? This will send you through the startup questions again and replace your generated targets.');"><button class="button danger-soft wide" type="submit">Redo startup setup</button></form>`;

    const advanced = document.createElement("details");
    advanced.className = "card compact-card settings-rebuilt advanced-macro-settings";
    advanced.innerHTML = `<summary>Advanced manual macro edit</summary><p class="muted">Use this only if you already know the exact targets you want. Redo setup is the better option for most changes.</p>`;
    advanced.appendChild(form);

    const doneRow = document.querySelector(".settings-done-row");
    doneRow?.insertAdjacentElement("afterend", planCard);
    planCard.insertAdjacentElement("afterend", targetCard);
    targetCard.insertAdjacentElement("afterend", resetCard);
    resetCard.insertAdjacentElement("afterend", advanced);
    originalFormCard?.remove();
    originalMealCard?.remove();
    removeDuplicateSettingsCards();
  }

  document.addEventListener("DOMContentLoaded", rebuildSettings);
  window.addEventListener("pageshow", rebuildSettings);
  window.setTimeout(rebuildSettings, 200);
  window.setTimeout(removeDuplicateSettingsCards, 650);
})();
