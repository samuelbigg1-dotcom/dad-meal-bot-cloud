(function () {
  function textOf(selector) {
    return document.querySelector(selector)?.textContent?.trim() || "";
  }

  function makeAction({ href, label, detail, icon = "" }) {
    const link = document.createElement("a");
    link.className = "quick-action";
    link.href = href;
    link.innerHTML = `<span class="quick-action-icon">${icon}</span><span><strong>${label}</strong><small>${detail}</small></span>`;
    return link;
  }

  function compactDashboard() {
    const hero = document.querySelector(".card.hero");
    if (!hero || document.querySelector(".quick-actions-card")) return;

    hero.classList.add("dashboard-hero", "compact-card");
    const copy = hero.querySelector("p");
    if (copy) copy.textContent = "Your day at a glance.";

    const originalActions = hero.querySelector(".action-row");
    if (originalActions) originalActions.remove();

    const quick = document.createElement("section");
    quick.className = "card quick-actions-card compact-card";
    quick.innerHTML = `<div class="section-head compact-head"><h2>Quick actions</h2><span>Fast access</span></div>`;

    const grid = document.createElement("div");
    grid.className = "quick-action-grid";
    grid.append(
      makeAction({ href: "/foods", label: "Scan food", detail: "Barcode or label", icon: "▥" }),
      makeAction({ href: "/log", label: "Log meal", detail: "Type meal", icon: "+" }),
      makeAction({ href: "/recommendations", label: "Recommend", detail: "Next meal", icon: "★" }),
      makeAction({ href: "/history", label: "History", detail: "Progress", icon: "↗" })
    );
    quick.appendChild(grid);
    hero.insertAdjacentElement("afterend", quick);
  }

  function compactFoods() {
    const content = document.querySelector(".content");
    if (!content || document.querySelector(".foods-quick-grid")) return;

    const hero = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("h2")?.textContent?.includes("Available foods"));
    if (hero) {
      hero.classList.add("compact-card", "foods-hero");
      const h2 = hero.querySelector("h2");
      const p = hero.querySelector("p");
      if (h2) h2.textContent = "Foods";
      if (p) p.textContent = "Scan, confirm, and manage what is available.";
    }

    const labelCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("#labelScanForm"));
    const barcodeCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("#barcodeImageScanForm"));
    const manualCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("h2")?.textContent?.includes("Add food manually"));
    const savedCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector(".food-list"));

    if (labelCard && barcodeCard) {
      labelCard.classList.add("scan-option-card", "compact-card");
      barcodeCard.classList.add("scan-option-card", "compact-card");

      const labelH = labelCard.querySelector("h2");
      const labelP = labelCard.querySelector("p.muted");
      if (labelH) labelH.textContent = "Scan Nutrition Facts";
      if (labelP) labelP.textContent = "Photo of the label.";

      const barcodeH = barcodeCard.querySelector("h2");
      const barcodeP = barcodeCard.querySelector("p.muted");
      if (barcodeH) barcodeH.textContent = "Scan barcode";
      if (barcodeP) barcodeP.textContent = "Photo or type the number.";

      const grid = document.createElement("div");
      grid.className = "foods-quick-grid";
      labelCard.parentNode.insertBefore(grid, labelCard);
      grid.appendChild(labelCard);
      grid.appendChild(barcodeCard);
    }

    if (manualCard) {
      manualCard.classList.add("compact-card", "manual-card");
      const h2 = manualCard.querySelector("h2");
      if (h2) h2.textContent = "Add manually";
    }

    if (savedCard) {
      savedCard.classList.add("compact-card", "saved-foods-card");
      const h2 = savedCard.querySelector("h2");
      if (h2) h2.textContent = "Your foods";
    }
  }

  function compactLog() {
    const card = document.querySelector(".card.hero");
    if (!card) return;
    card.classList.add("compact-card", "log-card");
    const h2 = card.querySelector("h2");
    const p = card.querySelector("p");
    const textarea = card.querySelector("textarea");
    if (h2) h2.textContent = "Log a meal";
    if (p) p.textContent = "Pick the meal type and type what was eaten.";
    if (textarea) {
      textarea.rows = 4;
      textarea.placeholder = "Example: 12 oz pork tenderloin, 1 cup rice, broccoli";
    }
  }

  function compactConfirm() {
    const confirmForm = document.querySelector("#confirm-package-form");
    const mealConfirm = document.querySelector("form[action='/log/confirm']");
    if (confirmForm) {
      document.body.classList.add("page-confirm-food");
      const hero = document.querySelector(".card.hero");
      if (hero) hero.classList.add("compact-card", "confirm-hero");
      confirmForm.closest(".card")?.classList.add("compact-card", "confirm-card");
    }
    if (mealConfirm) {
      document.body.classList.add("page-confirm-meal");
      mealConfirm.closest(".card")?.classList.add("compact-card", "confirm-card");
    }
  }

  function run() {
    const title = textOf("h1").toLowerCase();
    document.body.classList.add("compact-ui");

    if (title === "today") compactDashboard();
    if (title.includes("foods")) compactFoods();
    if (title.includes("log meal")) compactLog();
    if (title.includes("confirm")) compactConfirm();
  }

  document.addEventListener("DOMContentLoaded", run);
})();
