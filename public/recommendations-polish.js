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
      .compact-ui .rec-page-hero .totals-pill { margin-top: 12px; }
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
      .compact-ui .meal-build { display: grid; gap: 7px; margin: 10px 0; }
      .compact-ui .meal-part { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--line); border-radius: 16px; background: var(--card2); padding: 10px; }
      .compact-ui .meal-part strong { font-size: 14px; }
      .compact-ui .meal-part span { color: var(--accent); font-weight: 950; white-space: nowrap; }
      .compact-ui .meal-part-label { font-size: 11px; color: var(--muted); font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 3px; }
      .compact-ui .rec-actions { display: grid; gap: 8px; margin-top: 10px; }
      .compact-ui .rec-actions .button { width: 100%; justify-content: center; }
      .compact-ui .secondary-note { font-size: 12px; color: var(--muted); text-align: center; }
      .recommended-meals-card .meal-slot-grid { display:grid; gap:8px; grid-template-columns: repeat(2, minmax(0,1fr)); margin: 12px 0; }
      .recommended-meals-card label { border:1px solid var(--line); border-radius:16px; padding:10px; background:var(--card2); font-weight:900; display:flex; gap:8px; align-items:center; }
      .food-row.search-hidden { display: none !important; }
      .food-search-count { margin-top: 8px; font-size: 13px; color: var(--muted); }
    `;
    document.head.appendChild(style);
  }

  function removeExportCard() {
    document.querySelectorAll("section.card").forEach((card) => {
      const heading = text(card.querySelector("h2"));
      if (heading.toLowerCase() === "export") card.remove();
    });
  }

  function foodIconAndKind(name, detail) {
    const value = `${name} ${detail}`.toLowerCase();
    if (/broccoli/.test(value)) return ["🥦", "vegetable"];
    if (/carrot/.test(value)) return ["🥕", "vegetable"];
    if (/spinach|lettuce|salad|vegetable|zucchini|cucumber|pepper|tomato/.test(value)) return ["🥬", "vegetable"];
    if (/banana/.test(value)) return ["🍌", "fruit"];
    if (/apple/.test(value)) return ["🍎", "fruit"];
    if (/berries|berry/.test(value)) return ["🫐", "fruit"];
    if (/orange|mango|grape|pineapple|fruit/.test(value)) return ["🍊", "fruit"];
    if (/egg|eggs/.test(value)) return ["🥚", "protein"];
    if (/chicken|turkey/.test(value)) return ["🍗", "protein"];
    if (/beef|steak|pork/.test(value)) return ["🥩", "protein"];
    if (/salmon|tuna|shrimp|fish/.test(value)) return ["🐟", "protein"];
    if (/tofu|protein/.test(value)) return ["🍽️", "protein"];
    if (/yogurt|cottage|milk|cheese|fairlife|dairy/.test(value)) return ["🥣", "dairy"];
    if (/smoothie|shake/.test(value)) return ["🥤", "dairy"];
    if (/rice/.test(value)) return ["🍚", "carb"];
    if (/potato/.test(value)) return ["🥔", "carb"];
    if (/oat|cereal|granola/.test(value)) return ["🥣", "carb"];
    if (/bread|toast|bagel|muffin/.test(value)) return ["🥯", "carb"];
    if (/pasta|wrap|tortilla|quinoa/.test(value)) return ["🍝", "carb"];
    if (/peanut butter|almond|nuts/.test(value)) return ["🥜", "fat"];
    if (/avocado/.test(value)) return ["🥑", "fat"];
    if (/olive oil|mct oil|oil|butter/.test(value)) return ["🫒", "fat"];
    if (/honey|syrup|jam/.test(value)) return ["🍯", "carb"];
    if (/coca|cola|soda|pop|juice|drink/.test(value)) return ["🥤", "other"];
    return ["🍽️", "other"];
  }

  function addFoodThumbnails() {
    document.querySelectorAll(".food-row").forEach((row) => {
      const name = text(row.querySelector("strong"));
      const detail = text(row.querySelector("p"));
      const [icon, kind] = foodIconAndKind(name, detail);
      row.dataset.foodIcon = icon;
      row.dataset.foodKind = kind;
    });
  }

  function fixSavedFoodLiveSearch() {
    const input = document.querySelector(".food-search");
    const list = document.querySelector(".food-list");
    if (!input || !list || input.dataset.liveSearchFixed === "true") return;
    input.dataset.liveSearchFixed = "true";

    let count = document.querySelector(".food-search-count");
    if (!count) {
      count = document.createElement("p");
      count.className = "food-search-count";
      input.insertAdjacentElement("afterend", count);
    }

    const apply = () => {
      const query = input.value.trim().toLowerCase();
      const rows = [...list.querySelectorAll(".food-row")];
      let shown = 0;
      rows.forEach((row) => {
        const name = text(row.querySelector("strong")).toLowerCase();
        const allText = text(row).toLowerCase();
        const match = !query || name.includes(query) || allText.includes(query);
        row.classList.toggle("search-hidden", !match);
        row.hidden = !match;
        if (match) shown += 1;
      });
      count.textContent = query ? `${shown} matching food${shown === 1 ? "" : "s"}` : "";
    };

    input.addEventListener("input", apply);
    input.addEventListener("keyup", apply);
    input.addEventListener("search", apply);
    input.addEventListener("change", apply);
    apply();
  }

  function decodeFoodPayload(payload) {
    try { return JSON.parse(decodeURIComponent(escape(atob(payload)))); } catch (error) { return null; }
  }

  function encodeFoodPayload(food) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(food))));
  }

  function niceQty(qty, unit) {
    const num = Number(qty);
    if (!Number.isFinite(num)) return String(qty || 1);
    const cleanUnit = String(unit || "").toLowerCase().trim();
    const canFraction = ["cup", "cups", "c", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons"].includes(cleanUnit);
    if (canFraction) {
      const rounded = Math.round(num * 1000) / 1000;
      const fractions = [[0.25, "1/4"], [0.333, "1/3"], [0.5, "1/2"], [0.667, "2/3"], [0.75, "3/4"]];
      for (const [value, label] of fractions) if (Math.abs(rounded - value) < 0.015) return label;
      const whole = Math.floor(rounded);
      const remainder = Math.round((rounded - whole) * 1000) / 1000;
      for (const [value, label] of fractions) if (whole >= 1 && Math.abs(remainder - value) < 0.015) return `${whole} ${label}`;
    }
    return Number.isInteger(num) ? String(num) : String(Math.round(num * 1000) / 1000).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  function servingText(food) {
    if (food.servingText) return food.servingText;
    return `${niceQty(food.baseQty || 1, food.baseUnit)} ${food.baseUnit || "serving"}`.trim();
  }

  function patchConfirmServing() {
    const form = document.getElementById("confirm-package-form");
    if (!form) return;
    const hidden = form.querySelector("input[name='food']");
    if (!hidden || !hidden.value) return;
    const food = decodeFoodPayload(hidden.value);
    if (!food) return;

    const qtyInput = form.querySelector("input[name='baseQty']");
    const unitInput = form.querySelector("input[name='baseUnit']");
    if (qtyInput && Number.isFinite(Number(food.baseQty))) qtyInput.value = String(Math.round(Number(food.baseQty) * 1000) / 1000);
    if (unitInput && food.baseUnit) unitInput.value = food.baseUnit;

    const line = [...form.querySelectorAll("p")].find((p) => /serving|cup|tbsp|tsp|g\b|ml\b|oz\b/i.test(p.textContent || ""));
    if (line) line.textContent = servingText(food);

    form.addEventListener("submit", () => {
      const current = decodeFoodPayload(hidden.value) || food;
      const updated = { ...current, baseQty: Number(qtyInput?.value || current.baseQty || 1), baseUnit: unitInput?.value || current.baseUnit || "serving" };
      if (!updated.servingText) updated.servingText = servingText(updated);
      hidden.value = encodeFoodPayload(updated);
    });
  }

  function partLabel(name) {
    const n = String(name || "").toLowerCase();
    if (/chicken|salmon|tuna|beef|steak|turkey|pork|egg|yogurt|cottage|protein|shrimp|tofu/.test(n)) return "main";
    if (/rice|potato|bread|toast|wrap|tortilla|pasta|oat|quinoa|cereal/.test(n)) return "side";
    if (/broccoli|spinach|salad|lettuce|tomato|pepper|carrot|cucumber|vegetable|zucchini/.test(n)) return "veg";
    if (/banana|apple|berries|fruit|orange/.test(n)) return "fruit";
    if (/peanut butter|almond butter|avocado|nuts|oil|cheese/.test(n)) return "add-on";
    return "item";
  }

  function polishRecommendations() {
    const title = text(document.querySelector("h1")).toLowerCase();
    if (!title.includes("recommend")) return;
    injectStyles();
    const hero = document.querySelector("section.card.hero");
    if (hero) hero.classList.add("rec-page-hero", "compact-card");
    const cards = [...document.querySelectorAll(".rec-card")];
    cards.forEach((card, index) => {
      if (card.querySelector(".meal-suggestion-top")) return;
      card.classList.add("polished-rec-card", "compact-card");
      const heading = text(card.querySelector(".section-head h2")) || (index === 0 ? "Best fit for now" : `Option ${index + 1}`);
      const oldTitle = text(card.querySelector("h3")) || `Option ${index + 1}`;
      const explanation = text([...card.children].find((el) => el.tagName === "P" && !el.classList.contains("muted"))) || "This is a strong fit for where you are today.";
      const note = text([...card.children].find((el) => el.tagName === "P" && el.classList.contains("muted")));
      const rows = [...card.querySelectorAll(".list-row")].map((row) => {
        const name = text(row.querySelector("strong"));
        const detail = text(row.querySelector("p"));
        const cal = text(row.querySelector(".cal"));
        return { name, detail, cal, calories: firstNumber(cal), label: partLabel(name) };
      });
      const totalCalories = rows.reduce((sum, row) => sum + row.calories, 0);
      const form = card.querySelector("form");
      const parts = rows.map((row) => `<div class="meal-part"><div><div class="meal-part-label">${row.label}</div><strong>${row.name}</strong><p class="muted">${row.detail}</p></div><span>${row.cal || ""}</span></div>`).join("");
      const cloneForm = form ? form.outerHTML : "";
      const polished = document.createElement("div");
      polished.className = "meal-suggestion-top";
      polished.innerHTML = `<span class="meal-suggestion-label">${heading}</span><h2>${oldTitle}</h2><div class="meal-summary-row"><span>${Math.round(totalCalories)} cal</span><span>${rows.length} part${rows.length === 1 ? "" : "s"}</span></div><p class="why-this-works">${explanation}</p>${note ? `<p class="muted">${note}</p>` : ""}<div class="meal-build">${parts}</div><div class="rec-actions">${cloneForm}<div class="secondary-note">Built from available foods and checked for realistic pairings.</div></div>`;
      card.prepend(polished);
    });
  }

  function run() {
    injectStyles();
    removeExportCard();
    patchConfirmServing();
    addFoodThumbnails();
    fixSavedFoodLiveSearch();
    polishRecommendations();
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("pageshow", () => setTimeout(() => { addFoodThumbnails(); fixSavedFoodLiveSearch(); }, 0));
})();
