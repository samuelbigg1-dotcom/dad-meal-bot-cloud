(function () {
  function injectStyles() {
    if (document.getElementById("settings-polish-style")) return;
    const style = document.createElement("style");
    style.id = "settings-polish-style";
    style.textContent = `
      .settings-summary-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:14px; }
      .settings-summary-tile { border:1px solid var(--line); border-radius:18px; padding:12px; background:var(--card2); }
      .settings-summary-tile span { display:block; color:var(--muted); font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.1em; margin-bottom:4px; }
      .settings-summary-tile strong { font-size:19px; }
      .advanced-macro-settings summary { cursor:pointer; font-weight:950; font-size:18px; list-style:none; }
      .advanced-macro-settings summary::-webkit-details-marker { display:none; }
      .advanced-macro-settings summary::after { content:'Show'; float:right; color:var(--muted); font-size:13px; margin-top:4px; }
      .advanced-macro-settings[open] summary::after { content:'Hide'; }
      .reset-setup-card form { margin-top:12px; }
      .reset-setup-card .button.danger-soft { background:rgba(218,90,72,.12); border-color:rgba(218,90,72,.28); color:#ffb7aa; }
      @media (max-width: 560px) { .settings-summary-grid { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function val(name) {
    const input = document.querySelector(`form[action='/settings'] [name='${name}']`);
    return input?.value || "—";
  }

  function polishSettings() {
    const title = document.querySelector("h1")?.textContent?.trim().toLowerCase();
    if (title !== "settings" || document.querySelector(".setup-summary-card")) return;
    injectStyles();

    const content = document.querySelector(".content");
    const macroFormCard = document.querySelector("form[action='/settings']")?.closest("section.card");
    const macroHero = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("h2")?.textContent?.toLowerCase().includes("macro goals"));
    const mealsCard = document.querySelector(".recommended-meals-card");

    if (macroHero) {
      macroHero.classList.add("compact-card", "setup-summary-card");
      const h2 = macroHero.querySelector("h2");
      const p = macroHero.querySelector("p");
      if (h2) h2.textContent = "Your setup";
      if (p) p.textContent = "These targets came from your startup questions. Redo setup when height, weight, activity, or goal changes.";
      const summary = document.createElement("div");
      summary.className = "settings-summary-grid";
      summary.innerHTML = `
        <div class="settings-summary-tile"><span>Calories</span><strong>${val("calories")}</strong></div>
        <div class="settings-summary-tile"><span>Protein</span><strong>${val("protein")}g</strong></div>
        <div class="settings-summary-tile"><span>Carbs</span><strong>${val("carbs")}g</strong></div>
        <div class="settings-summary-tile"><span>Fat</span><strong>${val("fat")}g</strong></div>`;
      macroHero.appendChild(summary);
    }

    const resetCard = document.createElement("section");
    resetCard.className = "card compact-card reset-setup-card";
    resetCard.innerHTML = `<h2>Redo setup</h2><p class="muted">Run the startup wizard again to reset goal, height, weight, activity level, pace, eating style, and generated targets.</p><form method="post" action="/settings/reset-onboarding" onsubmit="return confirm('Redo setup? This will send you through the startup questions again and replace your generated targets.');"><button class="button danger-soft wide" type="submit">Redo startup setup</button></form>`;
    macroHero?.insertAdjacentElement("afterend", resetCard) || content?.prepend(resetCard);

    if (macroFormCard) {
      const details = document.createElement("details");
      details.className = "card compact-card advanced-macro-settings";
      details.innerHTML = `<summary>Advanced manual macro edit</summary><p class="muted">Most people should use Redo setup above. Use this only if you already know the exact targets you want.</p>`;
      macroFormCard.parentNode.insertBefore(details, macroFormCard);
      details.appendChild(macroFormCard.querySelector("form"));
      macroFormCard.remove();
    }

    if (mealsCard) {
      mealsCard.classList.add("compact-card");
      const h2 = mealsCard.querySelector("h2");
      if (h2) h2.textContent = "Meal routine";
    }
  }

  document.addEventListener("DOMContentLoaded", polishSettings);
  window.addEventListener("pageshow", polishSettings);
})();
