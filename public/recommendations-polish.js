(function () {
  const MEAL_SLOT_KEY = "recommendedMealSlots";
  const DEFAULT_SLOTS = ["breakfast", "lunch", "dinner", "snack"];
  const ALL_SLOTS = [
    ["breakfast", "Breakfast"],
    ["lunch", "Lunch"],
    ["dinner", "Dinner"],
    ["snack", "Snack"]
  ];

  function text(el) {
    return el?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function firstNumber(value) {
    const match = String(value || "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function readSlots() {
    try {
      const raw = localStorage.getItem(MEAL_SLOT_KEY);
      const parsed = raw ? JSON.parse(raw) : DEFAULT_SLOTS;
      const clean = parsed.filter((slot) => DEFAULT_SLOTS.includes(slot));
      return clean.length ? clean : DEFAULT_SLOTS;
    } catch (error) {
      return DEFAULT_SLOTS;
    }
  }

  function saveSlots(slots) {
    const clean = slots.filter((slot) => DEFAULT_SLOTS.includes(slot));
    const finalSlots = clean.length ? clean : DEFAULT_SLOTS;
    localStorage.setItem(MEAL_SLOT_KEY, JSON.stringify(finalSlots));
    document.cookie = `${MEAL_SLOT_KEY}=${encodeURIComponent(finalSlots.join(","))}; Path=/; Max-Age=31536000; SameSite=Lax`;
    return finalSlots;
  }

  function currentSlotGuess(slots) {
    const hour = new Date().getHours();
    const order = slots.length ? slots : DEFAULT_SLOTS;
    if (hour < 11 && order.includes("breakfast")) return "breakfast";
    if (hour < 16 && order.includes("lunch")) return "lunch";
    if (hour < 21 && order.includes("dinner")) return "dinner";
    if (order.includes("snack")) return "snack";
    return order[order.length - 1] || "dinner";
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
      .recommended-meals-card .slot-note { color:var(--muted); font-size:13px; line-height:1.35; }
    `;
    document.head.appendChild(style);
  }

  function removeExportCard() {
    document.querySelectorAll("section.card").forEach((card) => {
      const heading = text(card.querySelector("h2"));
      if (heading.toLowerCase() === "export") card.remove();
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

  function caloriesLeftFromHero() {
    const heroText = text(document.querySelector("section.card.hero"));
    const match = heroText.match(/(\d+)\s*cal/i);
    return match ? Number(match[1]) : 0;
  }

  function reorderForMealSlots(cards) {
    const slots = readSlots();
    const current = currentSlotGuess(slots);
    const fewSlots = slots.length <= 2;
    const calLeft = caloriesLeftFromHero();
    const target = current === "breakfast" ? Math.min(850, Math.max(450, calLeft * 0.32))
      : current === "lunch" ? Math.min(850, Math.max(500, calLeft * 0.45))
      : current === "snack" ? Math.min(450, Math.max(200, calLeft * 0.25))
      : Math.min(1050, Math.max(650, calLeft * (fewSlots ? 0.82 : 0.65)));

    const parent = cards[0]?.parentNode;
    if (!parent) return cards;
    const ranked = cards.map((card) => {
      const total = firstNumber(text(card.querySelector(".meal-summary-row span")) || text(card.querySelector(".cal")));
      const distance = Math.abs(total - target);
      const bonus = fewSlots && current === "dinner" && total >= 650 ? 160 : 0;
      const penalty = fewSlots && current === "dinner" && total < 450 ? 260 : 0;
      return { card, score: -distance + bonus - penalty };
    }).sort((a, b) => b.score - a.score);
    ranked.forEach(({ card }) => parent.appendChild(card));
    return ranked.map((x) => x.card);
  }

  function polishRecommendations() {
    const title = text(document.querySelector("h1")).toLowerCase();
    if (!title.includes("recommend")) return;
    injectStyles();

    const slots = readSlots();
    const current = currentSlotGuess(slots);
    const hero = document.querySelector("section.card.hero");
    if (hero) {
      hero.classList.add("rec-page-hero", "compact-card");
      const h2 = hero.querySelector("h2");
      const p = hero.querySelector("p");
      if (h2) h2.textContent = "What to eat next";
      if (p) p.textContent = `Planning around: ${slots.join(", ")}. Current slot: ${current}.`;
    }

    let cards = [...document.querySelectorAll(".rec-card")];
    cards.forEach((card, index) => {
      if (card.querySelector(".meal-suggestion-top")) return;
      card.classList.add("polished-rec-card", "compact-card");
      const oldTitle = text(card.querySelector("h3")) || `Option ${index + 1}`;
      const explanation = text([...card.children].find((el) => el.tagName === "P" && !el.classList.contains("muted"))) || "This is meant to be a realistic next meal, not just macro math.";
      const rows = [...card.querySelectorAll(".list-row")].map((row) => {
        const name = text(row.querySelector("strong"));
        const detail = text(row.querySelector("p"));
        const cal = text(row.querySelector(".cal"));
        return { name, detail, cal, calories: firstNumber(cal), label: partLabel(name) };
      });
      const totalCalories = rows.reduce((sum, row) => sum + row.calories, 0);
      const form = card.querySelector("form");
      const label = index === 0 ? "Best realistic pick" : `Option ${index + 1}`;
      const parts = rows.map((row) => `<div class="meal-part"><div><div class="meal-part-label">${row.label}</div><strong>${row.name}</strong><p class="muted">${row.detail}</p></div><span>${row.cal || ""}</span></div>`).join("");
      const cloneForm = form ? form.outerHTML.replace("Log this meal", index === 0 ? "Log this meal" : "Log option") : "";
      const polished = document.createElement("div");
      polished.className = "meal-suggestion-top";
      polished.innerHTML = `
        <span class="meal-suggestion-label">${label}</span>
        <h2>${oldTitle}</h2>
        <div class="meal-summary-row"><span>${Math.round(totalCalories)} cal</span><span>${rows.length} part${rows.length === 1 ? "" : "s"}</span></div>
        <p class="why-this-works">${explanation}</p>
        <div class="meal-build">${parts}</div>
        <div class="rec-actions">${cloneForm}<div class="secondary-note">These should fit the remaining day and your chosen meal slots.</div></div>
      `;
      card.prepend(polished);
    });
    cards = reorderForMealSlots([...document.querySelectorAll(".rec-card")]);
    cards.forEach((card, index) => {
      const label = card.querySelector(".meal-suggestion-label");
      if (label) label.textContent = index === 0 ? "Best fit for now" : `Option ${index + 1}`;
    });
  }

  function addRecommendedMealsSetting() {
    const title = text(document.querySelector("h1")).toLowerCase();
    if (!title.includes("settings") || document.querySelector(".recommended-meals-card")) return;
    injectStyles();
    const formCard = document.querySelector("form[action='/settings']")?.closest("section.card");
    if (!formCard) return;
    const selected = new Set(readSlots());
    const card = document.createElement("section");
    card.className = "card compact-card recommended-meals-card";
    card.innerHTML = `
      <h2>Recommended meals</h2>
      <p class="slot-note">Choose which meal slots this person usually eats. This changes how aggressively Meals tries to close the day.</p>
      <div class="meal-slot-grid">
        ${ALL_SLOTS.map(([value, label]) => `<label><input type="checkbox" value="${value}" ${selected.has(value) ? "checked" : ""}> ${label}</label>`).join("")}
      </div>
      <p class="slot-note">Default is breakfast, lunch, dinner, and snack. For your dad, choose breakfast and dinner.</p>
    `;
    formCard.insertAdjacentElement("afterend", card);
    card.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.addEventListener("change", () => {
        const values = [...card.querySelectorAll("input:checked")].map((box) => box.value);
        saveSlots(values);
      });
    });
  }

  function run() {
    removeExportCard();
    addRecommendedMealsSetting();
    polishRecommendations();
  }

  document.addEventListener("DOMContentLoaded", run);
})();
