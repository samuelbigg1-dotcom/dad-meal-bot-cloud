(function () {
  const STARTER_NAMES = new Set([
    "greek yogurt", "cottage cheese twarog", "protein powder", "peanut butter", "mct oil", "rolled oats",
    "apple", "blueberries frozen", "blueberry muffin", "muffin", "walnuts", "eggs", "pork tenderloin",
    "rice basmati", "broccoli", "honey", "chicken breast cooked", "olive oil", "banana", "toast", "butter",
    "potato cooked", "salmon cooked"
  ]);
  const LEGACY_DAD_ONLY = new Set(["dad smoothie"]);

  function text(el) { return el?.textContent?.replace(/\s+/g, " ").trim() || ""; }
  function foodName(row) { return text(row.querySelector("strong")).toLowerCase(); }

  function makeEmpty(title, copy) {
    const empty = document.createElement("div");
    empty.className = "empty foods-empty-state";
    empty.innerHTML = `<strong>${title}</strong><p>${copy}</p>`;
    return empty;
  }

  function section(title, subtitle, rows) {
    const wrap = document.createElement("section");
    wrap.className = "food-section-split";
    wrap.innerHTML = `<div class="section-head compact-head"><h2>${title}</h2><span>${subtitle}</span></div>`;
    const list = document.createElement("div");
    list.className = "food-list split-food-list";
    rows.forEach((row) => list.appendChild(row));
    if (!rows.length && title === "My foods") list.appendChild(makeEmpty("Your fridge is empty", "Scan a food or add a custom food. New accounts start clean."));
    if (!rows.length && title === "Starter foods") list.appendChild(makeEmpty("No starter foods showing", "Add foods as you use them."));
    wrap.appendChild(list);
    return wrap;
  }

  function createCustomFoodPanel() {
    let panel = document.querySelector(".custom-food-panel");
    if (panel) return panel;
    const savedCard = document.querySelector(".saved-foods-card");
    const anchor = document.querySelector(".foods-primary-scan") || savedCard || document.querySelector(".content");
    panel = document.createElement("section");
    panel.className = "card custom-food-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="section-head compact-head"><h2>Add custom food</h2><button class="button small" type="button" data-close-custom-food>Done</button></div>
      <p class="muted">Save a food you use often. Use numbers per serving.</p>
      <form method="post" action="/foods/manual" class="stack custom-food-form">
        <input class="input" name="name" placeholder="Food name" required>
        <div class="grid two">
          <input class="input" name="baseQty" type="number" step="0.001" min="0" placeholder="Serving qty" value="1" required>
          <input class="input" name="baseUnit" placeholder="Unit" value="serving" required>
        </div>
        <div class="grid two">
          <input class="input" name="calories" type="number" step="0.1" min="0" placeholder="Calories" required>
          <input class="input" name="protein" type="number" step="0.1" min="0" placeholder="Protein g" value="0">
          <input class="input" name="carbs" type="number" step="0.1" min="0" placeholder="Carbs g" value="0">
          <input class="input" name="fat" type="number" step="0.1" min="0" placeholder="Fat g" value="0">
          <input class="input" name="sugar" type="number" step="0.1" min="0" placeholder="Sugar g" value="0">
          <input class="input" name="fiber" type="number" step="0.1" min="0" placeholder="Fiber g" value="0">
        </div>
        <input type="hidden" name="category" value="custom">
        <input type="hidden" name="aliases" value="">
        <button class="button primary wide" type="submit">Save custom food</button>
      </form>`;
    anchor?.insertAdjacentElement("afterend", panel);
    panel.querySelector("[data-close-custom-food]")?.addEventListener("click", () => { panel.hidden = true; });
    return panel;
  }

  function wireAddCustomButton() {
    const title = document.querySelector("h1")?.textContent?.trim().toLowerCase() || "";
    if (!title.includes("foods")) return;
    const candidates = [...document.querySelectorAll("button, a, .action-card, .quick-action, [role='button']")];
    const addButton = candidates.find((el) => /add custom food/i.test(text(el)));
    if (!addButton || addButton.dataset.customFoodWired === "true") return;
    addButton.dataset.customFoodWired = "true";
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const panel = createCustomFoodPanel();
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => panel.querySelector("input[name='name']")?.focus(), 220);
    }, true);
  }

  function preserveAndHideManualCard(card) {
    if (!card || card.dataset.manualCardPreserved === "true") return;
    card.dataset.manualCardPreserved = "true";
    card.classList.add("manual-food-hidden-shell");
    card.setAttribute("aria-hidden", "true");
  }

  function removeDuplicateManualCard() {
    const title = document.querySelector("h1")?.textContent?.trim().toLowerCase() || "";
    if (!title.includes("foods")) return;

    for (const card of document.querySelectorAll("section.card")) {
      const body = text(card).toLowerCase();
      const heading = card.querySelector("h2")?.textContent?.trim().toLowerCase() || "";
      const hasManualForm = Boolean(card.querySelector("form[action='/foods/manual']"));
      const hasManualToggle = Boolean(card.querySelector("#toggleManualFoodForm, [data-toggle-manual-food]")) || body.includes("add food manually");
      const isFallbackDetails = card.closest("details.fallback-scans");
      const isPrimaryScan = card.classList.contains("foods-primary-scan");
      const isSavedFoods = card.classList.contains("saved-foods-card") || heading.includes("saved foods");
      const isNewPanel = card.classList.contains("custom-food-panel");

      if (!isNewPanel && !isFallbackDetails && !isPrimaryScan && !isSavedFoods && (hasManualForm || hasManualToggle) && (heading.includes("add food manually") || heading.includes("custom food") || body.includes("add food manually"))) {
        preserveAndHideManualCard(card);
      }
    }
  }

  function splitFoods() {
    const savedCard = document.querySelector(".saved-foods-card");
    if (!savedCard || savedCard.dataset.splitFoods === "true") return;
    const originalList = savedCard.querySelector(".food-list");
    if (!originalList) return;
    savedCard.dataset.splitFoods = "true";

    const rows = [...originalList.querySelectorAll(".food-row")];
    const myRows = [];
    const starterRows = [];
    rows.forEach((row) => {
      const name = foodName(row);
      if (LEGACY_DAD_ONLY.has(name)) {
        row.remove();
        return;
      }
      if (STARTER_NAMES.has(name)) starterRows.push(row);
      else myRows.push(row);
    });

    const oldIntro = savedCard.querySelector(":scope > p");
    if (oldIntro) oldIntro.textContent = "Your foods stay separate by Google account.";
    originalList.remove();
    savedCard.appendChild(section("My foods", `${myRows.length} saved`, myRows));
    savedCard.appendChild(section("Starter foods", "Optional basics", starterRows));
  }

  function injectStyles() {
    if (document.getElementById("foods-sections-style")) return;
    const style = document.createElement("style");
    style.id = "foods-sections-style";
    style.textContent = `
      .manual-food-hidden-shell { position:absolute!important; left:-9999px!important; top:auto!important; width:1px!important; height:1px!important; overflow:hidden!important; opacity:0!important; pointer-events:none!important; margin:0!important; padding:0!important; }
      .custom-food-panel[hidden] { display:none!important; }
      .custom-food-panel { margin-top:14px; }
      .custom-food-panel .grid.two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .custom-food-panel .section-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }
      .food-section-split { margin-top: 14px; }
      .food-section-split .section-head { margin-bottom: 8px; }
      .food-section-split .section-head h2 { font-size: 19px; }
      .split-food-list { display: grid; gap: 8px; }
      .foods-empty-state { border: 1px dashed var(--line); border-radius: 20px; padding: 16px; background: var(--card2); }
      .foods-empty-state strong { display:block; font-size:17px; margin-bottom:4px; }
      .foods-empty-state p { margin:0; color:var(--muted); }
      @media (max-width:560px){ .custom-food-panel .grid.two { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function run() {
    injectStyles();
    wireAddCustomButton();
    removeDuplicateManualCard();
    splitFoods();
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("pageshow", run);
  window.setTimeout(run, 150);
  window.setTimeout(run, 500);
  window.setTimeout(run, 1200);
})();
