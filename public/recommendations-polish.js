(function () {
  function text(el) {
    return el?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function firstNumber(value) {
    const match = String(value || "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function injectStyles() {
    if (document.getElementById("recommendations-polish-style")) return;
    const style = document.createElement("style");
    style.id = "recommendations-polish-style";
    style.textContent = `
      .compact-ui .rec-page-hero h2 { font-size: clamp(30px, 9vw, 46px); letter-spacing: -.055em; }
      .compact-ui .rec-page-hero .totals-pill { display: none; }
      .compact-ui .rec-page-hero p { margin-bottom: 0; }
      .compact-ui .rec-card.polished-rec-card { padding: 14px; border-radius: 24px; }
      .compact-ui .rec-card.polished-rec-card .score,
      .compact-ui .rec-card.polished-rec-card > h3,
      .compact-ui .rec-card.polished-rec-card > .section-head,
      .compact-ui .rec-card.polished-rec-card > .totals-pill,
      .compact-ui .rec-card.polished-rec-card > p,
      .compact-ui .rec-card.polished-rec-card > form,
      .compact-ui .rec-card.polished-rec-card > .list { display: none; }
      .compact-ui .meal-suggestion-top { display: grid; gap: 8px; }
      .compact-ui .meal-suggestion-label { display: inline-flex; width: fit-content; border-radius: 999px; border: 1px solid rgba(185,80,53,.25); padding: 6px 9px; color: var(--accent); font-size: 12px; font-weight: 900; background: color-mix(in srgb, var(--card2) 80%, rgba(185,80,53,.08)); }
      .compact-ui .meal-suggestion-top h2 { margin: 0; font-size: 23px; letter-spacing: -.03em; }
      .compact-ui .meal-summary-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0; }
      .compact-ui .meal-summary-row span { border: 1px solid var(--line); border-radius: 999px; padding: 7px 9px; font-size: 12px; font-weight: 900; background: var(--card2); }
      .compact-ui .why-this-works { color: var(--muted); line-height: 1.35; margin: 2px 0 8px; }
      .compact-ui .simple-ingredients { display: grid; gap: 7px; margin: 10px 0; }
      .compact-ui .simple-ingredient { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--line); border-radius: 16px; background: var(--card2); padding: 10px; }
      .compact-ui .simple-ingredient strong { font-size: 14px; }
      .compact-ui .simple-ingredient span { color: var(--accent); font-weight: 950; white-space: nowrap; }
      .compact-ui .rec-actions { display: grid; gap: 8px; margin-top: 10px; }
      .compact-ui .rec-actions .button { width: 100%; justify-content: center; }
      .compact-ui .secondary-note { font-size: 12px; color: var(--muted); text-align: center; }
    `;
    document.head.appendChild(style);
  }

  function removeExportCard() {
    document.querySelectorAll("section.card").forEach((card) => {
      const heading = text(card.querySelector("h2"));
      if (heading.toLowerCase() === "export") card.remove();
    });
  }

  function polishRecommendations() {
    const title = text(document.querySelector("h1")).toLowerCase();
    if (!title.includes("recommend")) return;
    injectStyles();

    const hero = document.querySelector("section.card.hero");
    if (hero) {
      hero.classList.add("rec-page-hero", "compact-card");
      const h2 = hero.querySelector("h2");
      const p = hero.querySelector("p");
      if (h2) h2.textContent = "What to eat next";
      if (p) p.textContent = "Simple meal ideas from foods marked available. Pick one, log it, and move on.";
    }

    const cards = [...document.querySelectorAll(".rec-card")];
    cards.forEach((card, index) => {
      if (card.querySelector(".meal-suggestion-top")) return;
      card.classList.add("polished-rec-card", "compact-card");
      const oldTitle = text(card.querySelector("h3")) || `Option ${index + 1}`;
      const explanation = text([...card.children].find((el) => el.tagName === "P" && !el.classList.contains("muted"))) || "This option is balanced for the rest of the day.";
      const rows = [...card.querySelectorAll(".list-row")].map((row) => {
        const name = text(row.querySelector("strong"));
        const detail = text(row.querySelector("p"));
        const cal = text(row.querySelector(".cal"));
        return { name, detail, cal, calories: firstNumber(cal) };
      });
      const totalCalories = rows.reduce((sum, row) => sum + row.calories, 0);
      const form = card.querySelector("form");
      const label = index === 0 ? "Best pick" : `Option ${index + 1}`;
      const ingredients = rows.map((row) => `<div class="simple-ingredient"><div><strong>${row.name}</strong><p class="muted">${row.detail}</p></div><span>${row.cal || ""}</span></div>`).join("");
      const cloneForm = form ? form.outerHTML.replace("Log this meal", index === 0 ? "Log best pick" : "Log this meal") : "";
      const polished = document.createElement("div");
      polished.className = "meal-suggestion-top";
      polished.innerHTML = `
        <span class="meal-suggestion-label">${label}</span>
        <h2>${oldTitle}</h2>
        <div class="meal-summary-row"><span>${Math.round(totalCalories)} cal</span><span>${rows.length} item${rows.length === 1 ? "" : "s"}</span></div>
        <p class="why-this-works">${explanation}</p>
        <div class="simple-ingredients">${ingredients}</div>
        <div class="rec-actions">${cloneForm}<div class="secondary-note">Not feeling this one? Scroll for another option.</div></div>
      `;
      card.prepend(polished);
    });
  }

  function run() {
    removeExportCard();
    polishRecommendations();
  }

  document.addEventListener("DOMContentLoaded", run);
})();
