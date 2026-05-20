(function () {
  let unifiedScanInput = null;

  function textOf(selector) { return document.querySelector(selector)?.textContent?.trim() || ""; }

  function makeAction({ href, label, detail, icon = "" }) {
    const link = document.createElement("a");
    link.className = "quick-action";
    link.href = href;
    link.innerHTML = `<span class="quick-action-icon">${icon}</span><span><strong>${label}</strong><small>${detail}</small></span>`;
    return link;
  }

  function submitHiddenForm(action, fields) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = action;
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  function setScanStatus(action, message) {
    const status = action.querySelector("small");
    if (status) status.textContent = message;
  }

  function getUnifiedScanInput() {
    if (unifiedScanInput) return unifiedScanInput;
    unifiedScanInput = document.createElement("input");
    unifiedScanInput.type = "file";
    unifiedScanInput.accept = "image/*";
    unifiedScanInput.capture = "environment";
    unifiedScanInput.className = "unified-scan-input";
    document.body.appendChild(unifiedScanInput);
    return unifiedScanInput;
  }

  function todayVancouver() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" }); }

  function foodToLogPayload(food) {
    const name = food.name || "Scanned food";
    const calories = Number(food.calories || 0);
    const protein = Number(food.protein || 0);
    const carbs = Number(food.carbs || 0);
    const fat = Number(food.fat || 0);
    const sugar = Number(food.sugar || 0);
    const fiber = Number(food.fiber || 0);
    return {
      parsedMeal: { meal_type: "snack", items: [] },
      items: [{ food_name: name, quantity: Number(food.baseQty || 1), unit: food.baseUnit || "serving", calories, protein_g: protein, carbs_g: carbs, fat_g: fat, sugar_g: sugar, fiber_g: fiber, confidence: "high", confidence_percent: 92, note: "Logged from food scan" }],
      mealTotals: { calories, protein_g: protein, carbs_g: carbs, fat_g: fat, sugar_g: sugar, fiber_g: fiber },
      rawMessage: `Scanned food: ${name}`,
      mealDate: todayVancouver()
    };
  }

  function readConfirmFood(form) {
    const hiddenFoodInput = form.querySelector("input[name='food']");
    if (!hiddenFoodInput || typeof decodeFoodPayload !== "function") return null;
    const food = decodeFoodPayload(hiddenFoodInput.value);
    const customName = form.querySelector("input[name='customName']")?.value?.trim();
    return { ...food, name: customName || food.name || "Scanned food" };
  }

  async function handleConfirmSaveMode(event) {
    const form = event.currentTarget;
    const mode = form.querySelector("input[name='saveMode']:checked")?.value || "fridge";
    if (mode === "fridge") return;
    event.preventDefault();
    const food = readConfirmFood(form);
    if (!food || typeof encodeFoodPayload !== "function") return form.submit();
    const payload = encodeFoodPayload(foodToLogPayload(food));
    if (mode === "both") {
      const formData = new FormData(form);
      await fetch(form.action, { method: "POST", body: new URLSearchParams(formData), credentials: "same-origin" });
    }
    submitHiddenForm("/log/confirm", { payload });
  }

  async function handleUnifiedFoodPhoto(file, action) {
    if (!file) return;
    if (typeof fileToCompressedDataUrl !== "function") throw new Error("Photo tools are still loading. Try once more.");
    if (typeof encodeFoodPayload !== "function") throw new Error("Food tools are still loading. Try once more.");
    setScanStatus(action, "Reading photo...");
    const imageDataUrl = await fileToCompressedDataUrl(file);
    setScanStatus(action, "Checking for barcode...");
    try {
      const barcodeResponse = await fetch("/foods/barcode-image-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }) });
      const barcodeData = await barcodeResponse.json().catch(() => ({}));
      const barcode = String(barcodeData.barcode || "").replace(/\D/g, "");
      if (barcodeResponse.ok && barcode) { setScanStatus(action, `Barcode found: ${barcode}`); submitHiddenForm("/foods/barcode", { barcode }); return; }
    } catch (error) {}
    setScanStatus(action, "Reading Nutrition Facts...");
    const labelResponse = await fetch("/foods/label-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }) });
    const labelData = await labelResponse.json().catch(() => ({}));
    if (!labelResponse.ok || !labelData.food) throw new Error(labelData.error || "Could not read this as a barcode or Nutrition Facts label.");
    setScanStatus(action, "Opening confirmation...");
    submitHiddenForm("/foods/confirm-scanned-label", { food: encodeFoodPayload(labelData.food) });
  }

  function openUnifiedScan(action) {
    const ok = window.confirm("Take a clear photo of either a barcode or the Nutrition Facts label.");
    if (!ok) return;
    const input = getUnifiedScanInput();
    input.value = "";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      action.disabled = true;
      try { await handleUnifiedFoodPhoto(file, action); }
      catch (error) { setScanStatus(action, error.message || "Scan failed. Try again."); action.disabled = false; input.value = ""; }
    };
    input.click();
  }

  function makeUnifiedScanAction({ big = false } = {}) {
    const action = document.createElement("button");
    action.className = `quick-action unified-scan-action${big ? " big" : ""}`;
    action.type = "button";
    action.innerHTML = `<span class="quick-action-icon">▥</span><span><strong>Scan food</strong><small>Barcode or Nutrition Facts</small></span>`;
    action.addEventListener("click", () => openUnifiedScan(action));
    return action;
  }

  function readMacroCards() {
    return [...document.querySelectorAll(".macro-card")].map((card) => {
      const label = card.querySelector(".macro-head span")?.textContent?.trim() || "";
      const percent = Number((card.querySelector(".macro-head strong")?.textContent || "0").match(/\d+/)?.[0] || 0);
      const firstLine = card.querySelector(".macro-values span:first-child")?.textContent || "";
      const secondLine = card.querySelector(".macro-values span:last-child")?.textContent || "";
      const values = (firstLine.match(/\d+(?:\.\d+)?/g) || []).map(Number);
      return { label, percent, current: values[0] || 0, goal: values[1] || 0, detail: secondLine };
    }).filter((m) => m.label);
  }

  function macro(macros, name) { return macros.find((m) => m.label === name); }
  function remaining(m) { return Math.max(0, Number(m?.goal || 0) - Number(m?.current || 0)); }

  function buildNextMove(macros) {
    const calories = macro(macros, "Calories");
    const protein = macro(macros, "Protein");
    const sugar = macro(macros, "Sugar");
    const fiber = macro(macros, "Fiber");
    const calLeft = Math.round(remaining(calories));
    const proteinLeft = Math.round(remaining(protein));
    const fiberLeft = Math.round(remaining(fiber));

    if (protein && protein.percent < 80) {
      return {
        title: "Next move",
        badge: "Protein first",
        body: `${calLeft} calories left today. Protein is still low${proteinLeft ? ` — about ${proteinLeft}g left` : ""}.${fiber && fiber.percent < 70 ? ` Fiber is low too, about ${fiberLeft}g left.` : ""}`,
        cta: "Meals can suggest a simple high-protein option from available foods."
      };
    }
    if (sugar && sugar.percent >= 90) {
      return {
        title: "Next move",
        badge: sugar.percent >= 105 ? "Sugar high" : "Watch sugar",
        body: `${calLeft} calories left today. Sugar is already ${sugar.percent >= 105 ? "over target" : "getting close"}, so the next meal should be lower sugar.`,
        cta: "Aim for protein and fiber instead of another sweet snack."
      };
    }
    if (calories && calories.percent >= 95) {
      return {
        title: "Next move",
        badge: "Keep it light",
        body: `Calories are almost used up for today. Protein-focused and smaller is the move now.`,
        cta: "Use Meals only if another meal is actually needed."
      };
    }
    return {
      title: "Next move",
      badge: "Balanced option",
      body: `${calLeft} calories left today. Nothing looks urgent, so keep the next meal balanced.`,
      cta: "Meals can pick from what is marked available."
    };
  }

  function addTodayStatus() {
    const hero = document.querySelector(".dashboard-hero");
    if (!hero || document.querySelector(".today-status-card")) return;
    const macros = readMacroCards();
    if (!macros.length) return;
    const next = buildNextMove(macros);
    const card = document.createElement("section");
    card.className = "card compact-card today-status-card next-move-card";
    card.innerHTML = `<div class="section-head compact-head"><h2>${next.title}</h2><span>${next.badge}</span></div><p>${next.body}</p><p class="muted">${next.cta}</p><a class="button primary wide" href="/recommendations">Open Meals</a>`;
    hero.insertAdjacentElement("afterend", card);
  }

  function compactDashboard() {
    const hero = document.querySelector(".card.hero");
    if (!hero || document.querySelector(".quick-actions-card")) return;
    hero.classList.add("dashboard-hero", "compact-card");
    const copy = hero.querySelector("p");
    if (copy) copy.textContent = "Check the day, log food, and pick the next move.";
    const originalActions = hero.querySelector(".action-row");
    if (originalActions) originalActions.remove();
    addTodayStatus();
    const quick = document.createElement("section");
    quick.className = "card quick-actions-card compact-card";
    quick.innerHTML = `<div class="section-head compact-head"><h2>Quick actions</h2><span>Fast access</span></div>`;
    const grid = document.createElement("div");
    grid.className = "quick-action-grid";
    grid.append(makeUnifiedScanAction(), makeAction({ href: "/log", label: "Log meal", detail: "Type meal", icon: "+" }), makeAction({ href: "/foods", label: "Foods", detail: "Saved items", icon: "⌕" }), makeAction({ href: "/history", label: "Progress", detail: "History", icon: "↗" }));
    quick.appendChild(grid);
    document.querySelector(".today-status-card")?.insertAdjacentElement("afterend", quick) || hero.insertAdjacentElement("afterend", quick);
  }

  function addFoodSearch(savedCard) {
    if (!savedCard || savedCard.querySelector(".food-search")) return;
    const input = document.createElement("input");
    input.className = "input food-search";
    input.type = "search";
    input.placeholder = "Search saved foods";
    const list = savedCard.querySelector(".food-list");
    savedCard.insertBefore(input, list);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      for (const row of savedCard.querySelectorAll(".food-row")) row.hidden = q && !row.textContent.toLowerCase().includes(q);
    });
  }

  function compactFoodActions(savedCard) {
    if (!savedCard) return;
    for (const row of savedCard.querySelectorAll(".food-row")) {
      if (row.querySelector(".food-action-menu")) continue;
      const actions = row.querySelector(".food-actions");
      if (!actions) continue;
      const details = document.createElement("details");
      details.className = "food-action-menu";
      details.innerHTML = `<summary>⋯</summary>`;
      actions.parentNode.insertBefore(details, actions);
      details.appendChild(actions);
    }
  }

  function compactFoods() {
    const content = document.querySelector(".content");
    if (!content || document.querySelector(".foods-primary-scan")) return;
    const hero = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("h2")?.textContent?.includes("Available foods"));
    if (hero) {
      hero.classList.add("compact-card", "foods-hero");
      const h2 = hero.querySelector("h2"); const p = hero.querySelector("p");
      if (h2) h2.textContent = "Foods";
      if (p) p.textContent = "Scan, save, search, or add custom foods.";
    }
    const labelCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("#labelScanForm"));
    const barcodeCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("#barcodeImageScanForm"));
    const manualCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector("h2")?.textContent?.includes("Add food manually"));
    const savedCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector(".food-list"));
    const primaryScan = document.createElement("section");
    primaryScan.className = "card compact-card foods-primary-scan";
    primaryScan.innerHTML = `<div class="section-head compact-head"><h2>Add food</h2><span>Fast</span></div>`;
    const actions = document.createElement("div"); actions.className = "quick-action-grid";
    actions.appendChild(makeUnifiedScanAction({ big: true }));
    const custom = makeAction({ href: "#", label: "Add custom food", detail: "Manual nutrition", icon: "+" });
    custom.addEventListener("click", (event) => { event.preventDefault(); document.getElementById("toggleManualFoodForm")?.click(); manualCard?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    actions.appendChild(custom); primaryScan.appendChild(actions);
    (hero || content.firstElementChild || content).insertAdjacentElement("afterend", primaryScan);
    if (labelCard && barcodeCard) {
      labelCard.classList.add("scan-option-card", "compact-card"); barcodeCard.classList.add("scan-option-card", "compact-card");
      const labelH = labelCard.querySelector("h2"); const labelP = labelCard.querySelector("p.muted");
      if (labelH) labelH.textContent = "Nutrition Facts only"; if (labelP) labelP.textContent = "Fallback label scanner.";
      const barcodeH = barcodeCard.querySelector("h2"); const barcodeP = barcodeCard.querySelector("p.muted");
      if (barcodeH) barcodeH.textContent = "Barcode only"; if (barcodeP) barcodeP.textContent = "Fallback barcode scanner.";
      const details = document.createElement("details"); details.className = "card compact-card fallback-scans"; details.innerHTML = `<summary>Trouble scanning?</summary>`;
      const grid = document.createElement("div"); grid.className = "foods-quick-grid"; details.appendChild(grid); primaryScan.insertAdjacentElement("afterend", details); grid.appendChild(labelCard); grid.appendChild(barcodeCard);
    }
    if (manualCard) { manualCard.classList.add("compact-card", "manual-card", "custom-food-card"); const h2 = manualCard.querySelector("h2"); if (h2) h2.textContent = "Custom food"; }
    if (savedCard) { savedCard.classList.add("compact-card", "saved-foods-card"); const h2 = savedCard.querySelector("h2"); if (h2) h2.textContent = "Saved foods"; addFoodSearch(savedCard); compactFoodActions(savedCard); }
  }

  function compactLog() {
    const card = document.querySelector(".card.hero"); if (!card) return;
    card.classList.add("compact-card", "log-card");
    const h2 = card.querySelector("h2"); const p = card.querySelector("p"); const textarea = card.querySelector("textarea");
    if (h2) h2.textContent = "Log a meal"; if (p) p.textContent = "Type it like a message.";
    if (textarea) { textarea.rows = 4; textarea.placeholder = "I had 3 eggs, 5 roma tomatoes, 2 slices toast..."; }
  }

  function decodeMealPayload(form) {
    const value = form.querySelector("input[name='payload']")?.value || "";
    if (!value) return null;
    try {
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "===".slice((normalized.length + 3) % 4);
      return JSON.parse(decodeURIComponent(escape(atob(padded))));
    } catch (error) {
      try { return JSON.parse(atob(value)); } catch (inner) { return null; }
    }
  }

  function confidenceFallback(row) {
    const raw = row.textContent.toLowerCase();
    let score = raw.includes("high confidence") ? 92 : raw.includes("medium confidence") ? 65 : 45;
    if (/starbucks|tim hortons|mcdonald|restaurant|burger king|wendy|subway|a&w|taco bell|kfc/.test(raw) && !raw.includes("high confidence")) score = Math.min(score, 55);
    return score;
  }

  function addMealConfidenceTools() {
    const form = document.querySelector("form[action='/log/confirm']");
    if (!form || document.querySelector(".confidence-warning")) return;
    const payload = decodeMealPayload(form);
    const payloadItems = Array.isArray(payload?.items) ? payload.items : [];
    const rows = [...document.querySelectorAll(".confirm-card .list-row, .page-confirm-meal .list-row")];
    let lowest = 100;
    for (const [idx, row] of rows.entries()) {
      const item = payloadItems[idx] || {};
      const score = Number.isFinite(Number(item.confidence_percent)) ? Math.round(Number(item.confidence_percent)) : confidenceFallback(row);
      lowest = Math.min(lowest, score);
      row.classList.add("confidence-row", score < 60 ? "low-confidence" : score < 80 ? "medium-confidence" : "high-confidence");
      const info = row.querySelector("p");
      if (info && !info.querySelector(".confidence-score")) info.insertAdjacentHTML("beforeend", ` <span class="confidence-score">${score}% confidence</span>`);
      if (item.note && info && !info.querySelector(".confidence-note")) info.insertAdjacentHTML("beforeend", `<span class="confidence-note">${item.note}</span>`);
      if (score < 60 && !row.querySelector(".double-check-link")) {
        const name = row.querySelector("strong")?.textContent?.trim() || "food";
        const link = document.createElement("a");
        link.className = "double-check-link";
        link.href = `https://www.google.com/search?q=${encodeURIComponent(name + " calories nutrition")}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Double check nutrition";
        row.appendChild(link);
      }
    }
    if (lowest < 60) {
      const warning = document.createElement("div");
      warning.className = "confidence-warning";
      warning.innerHTML = `<strong>Extra confirmation required</strong><p>One or more items are below 60% confidence. Double check restaurant, branded, or unclear items before saving.</p><label class="confirm-low-confidence"><input type="checkbox" required> I checked the low-confidence item(s)</label>`;
      form.insertAdjacentElement("beforebegin", warning);
      const requiredInput = warning.querySelector("input");
      form.addEventListener("submit", (event) => {
        if (!requiredInput.checked) {
          event.preventDefault();
          requiredInput.focus();
          warning.classList.add("shake-once");
          window.setTimeout(() => warning.classList.remove("shake-once"), 350);
        }
      });
      const saveButton = form.querySelector("button[type='submit']");
      if (saveButton) saveButton.textContent = "Save anyway";
    }
  }

  function compactHistory() {
    document.querySelectorAll("section.card").forEach((card) => card.classList.add("compact-card"));
  }

  function compactConfirm() {
    const confirmForm = document.querySelector("#confirm-package-form");
    const mealConfirm = document.querySelector("form[action='/log/confirm']");
    if (confirmForm) {
      document.body.classList.add("page-confirm-food");
      const hero = document.querySelector(".card.hero"); if (hero) hero.classList.add("compact-card", "confirm-hero");
      confirmForm.closest(".card")?.classList.add("compact-card", "confirm-card");
      if (!confirmForm.querySelector(".scan-save-mode")) {
        const mode = document.createElement("div"); mode.className = "scan-save-mode";
        mode.innerHTML = `<label class="field-label">Use this scan as</label><div class="segmented three"><label><input type="radio" name="saveMode" value="fridge" checked><span>Add to fridge</span></label><label><input type="radio" name="saveMode" value="log"><span>I ate this today</span></label><label><input type="radio" name="saveMode" value="both"><span>Both</span></label></div>`;
        const actions = confirmForm.querySelector(".action-row"); confirmForm.insertBefore(mode, actions || null);
        const primaryButton = confirmForm.querySelector("button[type='submit']"); if (primaryButton) primaryButton.textContent = "Save";
      }
      confirmForm.addEventListener("submit", handleConfirmSaveMode);
    }
    if (mealConfirm) {
      document.body.classList.add("page-confirm-meal");
      mealConfirm.closest(".card")?.classList.add("compact-card", "confirm-card");
      addMealConfidenceTools();
    }
  }

  function run() {
    const title = textOf("h1").toLowerCase();
    document.body.classList.add("compact-ui");
    if (title === "today") compactDashboard();
    if (title.includes("foods")) compactFoods();
    if (title.includes("log meal")) compactLog();
    if (title.includes("confirm")) compactConfirm();
    if (title.includes("history") || title.includes("progress")) compactHistory();
  }

  document.addEventListener("DOMContentLoaded", run);
})();
