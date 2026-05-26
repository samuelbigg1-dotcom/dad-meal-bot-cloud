(function () {
  let unifiedScanInput = null;
  let scanOverlay = null;

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
    const status = action?.querySelector?.("small");
    if (status) status.textContent = message;
  }

  function injectScanOverlayStyles() {
    if (document.getElementById("scan-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "scan-overlay-style";
    style.textContent = `
      .scan-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 22px;
        background: rgba(0,0,0,.58);
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      }
      .scan-overlay-card {
        width: min(100%, 540px);
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 34px;
        padding: 32px 28px 28px;
        background: linear-gradient(160deg, rgba(34,38,43,.96), rgba(20,22,26,.97));
        box-shadow: 0 28px 90px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.05);
        color: var(--text, #f6f1ea);
        text-align: center;
      }
      .scan-ring {
        --scan-progress: 6;
        position: relative;
        width: 138px;
        height: 138px;
        margin: 0 auto 20px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: conic-gradient(var(--accent, #d87b55) calc(var(--scan-progress) * 1%), rgba(255,255,255,.08) 0);
        filter: drop-shadow(0 0 22px rgba(216,123,85,.18));
        transition: background .45s ease;
      }
      .scan-ring::before {
        content: "";
        position: absolute;
        inset: 10px;
        border-radius: inherit;
        background: #17191d;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.05);
      }
      .scan-ring-icon {
        position: relative;
        z-index: 1;
        width: 58px;
        height: 58px;
        color: var(--accent, #d87b55);
      }
      .scan-ring-icon svg { width: 100%; height: 100%; display: block; }
      .scan-overlay-title {
        margin: 0 0 8px;
        font-size: clamp(28px, 7vw, 42px);
        letter-spacing: -.055em;
        line-height: 1;
      }
      .scan-overlay-subtitle {
        margin: 0 auto 24px;
        max-width: 320px;
        color: var(--muted, rgba(246,241,234,.68));
        font-size: 16px;
        line-height: 1.45;
      }
      .scan-step-list {
        display: grid;
        gap: 12px;
        margin: 0 auto 22px;
        max-width: 430px;
      }
      .scan-step {
        display: grid;
        grid-template-columns: 42px 1fr auto;
        gap: 12px;
        align-items: center;
        min-height: 66px;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 999px;
        padding: 10px 14px 10px 10px;
        background: rgba(255,255,255,.025);
        text-align: left;
        position: relative;
      }
      .scan-step + .scan-step::before {
        content: "";
        position: absolute;
        left: 31px;
        top: -13px;
        width: 1px;
        height: 14px;
        background: linear-gradient(var(--accent, #d87b55), transparent);
        opacity: .55;
      }
      .scan-step-num {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-weight: 950;
        background: rgba(255,255,255,.055);
        color: var(--text, #f6f1ea);
        border: 1px solid rgba(255,255,255,.08);
      }
      .scan-step-label {
        font-size: 15px;
        font-weight: 950;
        letter-spacing: -.02em;
      }
      .scan-chip {
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 950;
        white-space: nowrap;
        background: rgba(255,255,255,.05);
        color: var(--muted, rgba(246,241,234,.68));
      }
      .scan-chip.scan-active { color: var(--accent, #d87b55); background: rgba(216,123,85,.12); }
      .scan-chip.scan-success { color: #9bd6a0; background: rgba(75,160,95,.13); }
      .scan-chip.scan-warn { color: #f2a27f; background: rgba(216,123,85,.13); }
      .scan-chip.scan-error { color: #ffb0a8; background: rgba(220,70,60,.16); }
      .scan-footer {
        margin: 2px auto 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        max-width: 360px;
        color: var(--muted, rgba(246,241,234,.72));
        line-height: 1.42;
      }
      .scan-footer-star { color: var(--accent, #d87b55); font-size: 24px; }
      .scan-overlay-card.scan-error-state .scan-ring {
        background: conic-gradient(#e56b5f calc(var(--scan-progress) * 1%), rgba(255,255,255,.08) 0);
      }
      @media (max-width: 520px) {
        .scan-overlay { padding: 16px; align-items: center; }
        .scan-overlay-card { padding: 28px 20px 24px; border-radius: 30px; }
        .scan-ring { width: 118px; height: 118px; }
        .scan-ring-icon { width: 50px; height: 50px; }
        .scan-step { grid-template-columns: 38px 1fr; border-radius: 24px; padding: 12px; }
        .scan-step-num { width: 38px; height: 38px; }
        .scan-chip { grid-column: 2; width: fit-content; }
      }
    `;
    document.head.appendChild(style);
  }

  function scanIconSvg() {
    return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M14 23v-7a2 2 0 0 1 2-2h7"/><path d="M41 14h7a2 2 0 0 1 2 2v7"/>
      <path d="M50 41v7a2 2 0 0 1-2 2h-7"/><path d="M23 50h-7a2 2 0 0 1-2-2v-7"/>
      <path d="M24 28v8M30 28v8M36 28v8M42 28v8"/>
    </svg>`;
  }

  function ensureScanOverlay() {
    injectScanOverlayStyles();
    if (scanOverlay) return scanOverlay;
    scanOverlay = document.createElement("div");
    scanOverlay.className = "scan-overlay";
    scanOverlay.setAttribute("role", "status");
    scanOverlay.setAttribute("aria-live", "polite");
    scanOverlay.innerHTML = `<div class="scan-overlay-card">
      <div class="scan-ring" style="--scan-progress:6"><div class="scan-ring-icon">${scanIconSvg()}</div></div>
      <h2 class="scan-overlay-title">Scanning your food</h2>
      <p class="scan-overlay-subtitle">We’ll check barcode first, then the nutrition label if needed.</p>
      <div class="scan-step-list">
        <div class="scan-step" data-step="barcode"><div class="scan-step-num">1</div><div class="scan-step-label">Barcode check</div><div class="scan-chip scan-active">Starting…</div></div>
        <div class="scan-step" data-step="label"><div class="scan-step-num">2</div><div class="scan-step-label">Nutrition label check</div><div class="scan-chip">Waiting</div></div>
      </div>
      <div class="scan-footer"><span class="scan-footer-star">✦</span><span>Hang tight! This helps us give you accurate nutrition data.</span></div>
    </div>`;
    return scanOverlay;
  }

  function showScanOverlay() {
    const overlay = ensureScanOverlay();
    if (!overlay.isConnected) document.body.appendChild(overlay);
    updateScanOverlay({ progress: 8, barcode: { text: "Starting…", state: "active" }, label: { text: "Waiting", state: "idle" } });
  }

  function updateScanOverlay({ progress, barcode, label, title, subtitle, error = false } = {}) {
    const overlay = ensureScanOverlay();
    const card = overlay.querySelector(".scan-overlay-card");
    const ring = overlay.querySelector(".scan-ring");
    if (typeof progress === "number") ring?.style.setProperty("--scan-progress", String(Math.max(0, Math.min(100, progress))));
    if (title) overlay.querySelector(".scan-overlay-title").textContent = title;
    if (subtitle) overlay.querySelector(".scan-overlay-subtitle").textContent = subtitle;
    card?.classList.toggle("scan-error-state", Boolean(error));

    const setStep = (name, data) => {
      if (!data) return;
      const chip = overlay.querySelector(`[data-step='${name}'] .scan-chip`);
      if (!chip) return;
      chip.textContent = data.text || chip.textContent;
      chip.className = `scan-chip ${data.state ? `scan-${data.state}` : ""}`.trim();
    };
    setStep("barcode", barcode);
    setStep("label", label);
  }

  function hideScanOverlay(delay = 0) {
    window.setTimeout(() => {
      if (scanOverlay?.isConnected) scanOverlay.remove();
    }, delay);
  }

  function failScanOverlay(message) {
    updateScanOverlay({
      progress: 100,
      title: "Couldn’t scan this photo",
      subtitle: message || "Try a clearer Nutrition Facts label or barcode.",
      barcode: { text: "Not found", state: "error" },
      label: { text: "Not found", state: "error" },
      error: true
    });
    hideScanOverlay(2200);
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

  async function tryBarcodeScan(imageDataUrl, action) {
    setScanStatus(action, "Checking barcode...");
    updateScanOverlay({ progress: 28, barcode: { text: "Scanning…", state: "active" }, label: { text: "Waiting", state: "idle" } });
    const barcodeResponse = await fetch("/foods/barcode-image-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }) });
    const barcodeData = await barcodeResponse.json().catch(() => ({}));
    const barcode = String(barcodeData.barcode || "").replace(/\D/g, "");
    if (!barcodeResponse.ok || !barcode) {
      setScanStatus(action, "No barcode found — checking label...");
      updateScanOverlay({ progress: 44, barcode: { text: "No barcode found", state: "warn" }, label: { text: "Starting…", state: "active" } });
      return false;
    }
    setScanStatus(action, `Barcode found: ${barcode}`);
    updateScanOverlay({ progress: 100, barcode: { text: "Barcode found", state: "success" }, label: { text: "Skipped", state: "idle" } });
    hideScanOverlay(550);
    submitHiddenForm("/foods/barcode", { barcode });
    return true;
  }

  async function tryNutritionLabelScan(imageDataUrl, action) {
    setScanStatus(action, "Reading Nutrition Facts...");
    updateScanOverlay({ progress: 68, barcode: { text: "No barcode found", state: "warn" }, label: { text: "Scanning…", state: "active" } });
    const labelResponse = await fetch("/foods/label-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }) });
    const labelData = await labelResponse.json().catch(() => ({}));
    if (!labelResponse.ok || !labelData.food) throw new Error(labelData.error || "Could not read Nutrition Facts.");
    setScanStatus(action, "Nutrition label found");
    updateScanOverlay({ progress: 100, barcode: { text: "No barcode found", state: "warn" }, label: { text: "Nutrition label found", state: "success" } });
    hideScanOverlay(550);
    submitHiddenForm("/foods/confirm-scanned-label", { food: encodeFoodPayload(labelData.food) });
    return true;
  }

  async function handleUnifiedFoodPhoto(file, action) {
    if (!file) return;
    if (typeof fileToCompressedDataUrl !== "function") throw new Error("Photo tools are still loading. Try once more.");
    if (typeof encodeFoodPayload !== "function") throw new Error("Food tools are still loading. Try once more.");
    setScanStatus(action, "Reading photo...");
    showScanOverlay();
    updateScanOverlay({ progress: 14, barcode: { text: "Preparing…", state: "active" }, label: { text: "Waiting", state: "idle" } });
    const imageDataUrl = await fileToCompressedDataUrl(file);
    const barcodeFound = await tryBarcodeScan(imageDataUrl, action);
    if (barcodeFound) return;
    await tryNutritionLabelScan(imageDataUrl, action);
  }

  function openUnifiedScan(action) {
    const input = getUnifiedScanInput();
    input.value = "";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      action.disabled = true;
      try { await handleUnifiedFoodPhoto(file, action); }
      catch (error) {
        const message = error.message || "Scan failed. Try again.";
        setScanStatus(action, message);
        failScanOverlay(message);
        action.disabled = false;
        input.value = "";
      }
    };
    input.click();
  }

  function makeUnifiedScanAction({ big = false } = {}) {
    const action = document.createElement("button");
    action.className = `quick-action unified-scan-action${big ? " big" : ""}`;
    action.type = "button";
    action.innerHTML = `<span class="quick-action-icon">▥</span><span><strong>Scan food</strong><small>Nutrition Facts or barcode</small></span>`;
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
      return { title: "Next move", badge: "Protein first", body: `${calLeft} calories left today. Protein is still low${proteinLeft ? ` — about ${proteinLeft}g left` : ""}.${fiber && fiber.percent < 70 ? ` Fiber is low too, about ${fiberLeft}g left.` : ""}`, cta: "Meals can suggest a simple high-protein option from available foods." };
    }
    if (sugar && sugar.percent >= 90) {
      return { title: "Next move", badge: sugar.percent >= 105 ? "Sugar high" : "Watch sugar", body: `${calLeft} calories left today. Sugar is already ${sugar.percent >= 105 ? "over target" : "getting close"}, so the next meal should be lower sugar.`, cta: "Aim for protein and fiber instead of another sweet snack." };
    }
    if (calories && calories.percent >= 95) {
      return { title: "Next move", badge: "Keep it light", body: `Calories are almost used up for today. Protein-focused and smaller is the move now.`, cta: "Use Meals only if another meal is actually needed." };
    }
    return { title: "Next move", badge: "Balanced option", body: `${calLeft} calories left today. Nothing looks urgent, so keep the next meal balanced.`, cta: "Meals can pick from what is marked available." };
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
    if (hero) { hero.classList.add("compact-card", "foods-hero"); const h2 = hero.querySelector("h2"); const p = hero.querySelector("p"); if (h2) h2.textContent = "Foods"; if (p) p.textContent = "Scan, save, search, or add custom foods."; }
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

  function cleanConfirmRowText(row, score, item) {
    const info = row.querySelector("p");
    if (!info) return;
    const qty = item.quantity || "";
    const unit = item.unit || "";
    const note = String(item.note || "").replace(/^Matched known food:\s*/i, "Matched: ").replace(/Used base portion because unit did not match:.*/i, "Using saved serving size.");
    info.textContent = `${qty} ${unit} • ${score}% confidence${note ? ` • ${note}` : ""}`.replace(/\s+/g, " ").trim();
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
      cleanConfirmRowText(row, score, item);
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

  function compactHistory() { document.querySelectorAll("section.card").forEach((card) => card.classList.add("compact-card")); }

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
