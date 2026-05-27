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

      if (!isFallbackDetails && !isPrimaryScan && !isSavedFoods && (hasManualForm || hasManualToggle) && (heading.includes("add food manually") || heading.includes("custom food") || body.includes("add food manually"))) {
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
      .manual-food-hidden-shell {
        position: absolute !important;
        left: -9999px !important;
        top: auto !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .food-section-split { margin-top: 14px; }
      .food-section-split .section-head { margin-bottom: 8px; }
      .food-section-split .section-head h2 { font-size: 19px; }
      .split-food-list { display: grid; gap: 8px; }
      .foods-empty-state { border: 1px dashed var(--line); border-radius: 20px; padding: 16px; background: var(--card2); }
      .foods-empty-state strong { display:block; font-size:17px; margin-bottom:4px; }
      .foods-empty-state p { margin:0; color:var(--muted); }
    `;
    document.head.appendChild(style);
  }

  function run() {
    injectStyles();
    removeDuplicateManualCard();
    splitFoods();
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("pageshow", run);
  window.setTimeout(run, 150);
  window.setTimeout(run, 500);
  window.setTimeout(run, 1200);
})();
