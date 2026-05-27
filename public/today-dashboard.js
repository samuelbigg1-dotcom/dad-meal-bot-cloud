(function () {
  let homeScanInput = null;
  let homeScanBusy = false;

  function text(el) { return (el?.textContent || "").replace(/\s+/g, " ").trim(); }
  function parseNumber(value) { const match = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return match ? Number(match[0]) : 0; }

  function readMacroData() {
    const script = document.getElementById("home-macro-data");
    if (script?.textContent) {
      try {
        return JSON.parse(script.textContent).map((m) => ({
          label: m.label,
          current: Number(m.current || 0),
          goal: Number(m.goal || 0),
          unit: m.unit || (/calorie/i.test(m.label) ? "cal" : "g"),
          left: Number(m.left || 0),
          over: Boolean(m.over),
          percent: Number(m.percent || 0)
        }));
      } catch (error) {}
    }
    const macroGrid = document.querySelector(".macro-grid");
    if (!macroGrid) return [];
    return [...macroGrid.querySelectorAll(".macro-card")].map((card) => {
      const label = card?.dataset?.macro || text(card?.querySelector(".macro-head span"));
      const values = [...card.querySelectorAll(".macro-values span")].map(text);
      const first = values[0] || "";
      const [currentRaw, goalRaw] = first.split("/").map((part) => part || "");
      const current = parseNumber(currentRaw);
      const goal = parseNumber(goalRaw);
      return { label, current, goal, unit: /cal/i.test(first) || label === "Calories" ? "cal" : "g", left: Math.max(0, goal - current), over: current > goal, percent: goal ? Math.round((current / goal) * 100) : 0 };
    });
  }

  function buildNextMove(macros) {
    const protein = macros.find((m) => /protein/i.test(m.label));
    const fiber = macros.find((m) => /fiber/i.test(m.label));
    const calories = macros.find((m) => /calorie/i.test(m.label));
    const proteinLeft = Math.max(0, Math.round((protein?.goal || 0) - (protein?.current || 0)));
    const fiberLeft = Math.max(0, Math.round((fiber?.goal || 0) - (fiber?.current || 0)));
    const caloriesLeft = Math.max(0, Math.round((calories?.goal || 0) - (calories?.current || 0)));
    if (proteinLeft > 25) return { tag: "Protein first 💪", copy: `${caloriesLeft} calories left today. Protein is still low — about ${proteinLeft}g left.${fiberLeft > 5 ? ` Fiber is low too, about ${fiberLeft}g left.` : ""}` };
    if (fiberLeft > 8) return { tag: "Add fiber", copy: `${caloriesLeft} calories left today. Fiber is still low — add fruit, oats, potatoes, beans, or vegetables with the next meal.` };
    if (caloriesLeft > 600) return { tag: "Build a meal", copy: `${caloriesLeft} calories left today. A balanced meal with protein, carbs, and some fat should fit well.` };
    return { tag: "Easy finish", copy: `${caloriesLeft} calories left today. Keep the next choice simple and close out the day without overthinking it.` };
  }

  function macroMarkup(macros) {
    return `<div class="today-compact-macros">${macros.map((m) => {
      const pct = Math.max(0, Math.min(140, Number(m.percent || (m.goal ? (m.current / m.goal) * 100 : 0))));
      const goalText = /calorie/i.test(m.label) ? `${m.goal} cal` : `${m.goal}${m.unit || "g"}`;
      const currentText = /calorie/i.test(m.label) ? `${m.current}` : `${m.current}${m.unit || "g"}`;
      const leftText = /calorie/i.test(m.label) ? `${m.left} left` : `${m.left}${m.unit || "g"} left`;
      return `<section class="today-macro-stat"><div><strong>${m.label}</strong><span>${Math.round(pct)}%</span></div><div class="today-mini-bar"><i style="width:${Math.min(pct,100)}%"></i></div><p>${currentText} / ${goalText}<br>${m.over ? "over" : leftText}</p></section>`;
    }).join("")}</div>`;
  }

  function addBottomNavIcons() {
    const labels = { Foods: "⚑", Log: "+", Today: "☼", Home: "☼", Meals: "♨", Progress: "▥" };
    document.querySelectorAll(".bottom-nav a").forEach((link) => {
      if (link.dataset.navIconReady === "true") return;
      const label = text(link);
      link.dataset.navLabel = label;
      link.innerHTML = `<span class="nav-icon">${labels[label] || "•"}</span><span class="nav-label">${label}</span>`;
      link.dataset.navIconReady = "true";
    });
  }

  function submitHiddenForm(action, fields) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = action;
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  function encodePayload(data) {
    if (typeof window.encodeFoodPayload === "function") return window.encodeFoodPayload(data);
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }

  function getHomeScanInput() {
    if (homeScanInput) return homeScanInput;
    homeScanInput = document.createElement("input");
    homeScanInput.type = "file";
    homeScanInput.accept = "image/*";
    homeScanInput.capture = "environment";
    homeScanInput.className = "home-scan-input";
    homeScanInput.style.display = "none";
    document.body.appendChild(homeScanInput);
    return homeScanInput;
  }

  function showHomeScanOverlay(title = "Scanning your food", subtitle = "Preparing photo…") {
    let overlay = document.querySelector(".home-scan-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "scan-overlay home-scan-overlay";
      overlay.innerHTML = `<div class="scan-overlay-card"><button class="scan-overlay-close" type="button" aria-label="Close">×</button><div class="scan-ring" style="--scan-progress:12"><div class="scan-ring-icon">▥</div></div><h2 class="scan-overlay-title"></h2><p class="scan-overlay-subtitle"></p><div class="scan-step-list"><div class="scan-step"><div class="scan-step-num">1</div><div class="scan-step-label">Barcode check</div><div class="scan-chip scan-active" data-home-barcode>Starting…</div></div><div class="scan-step"><div class="scan-step-num">2</div><div class="scan-step-label">Nutrition label check</div><div class="scan-chip" data-home-label>Waiting</div></div></div><div class="scan-footer"><span class="scan-footer-star">✦</span><span>Hang tight! This helps us give you accurate nutrition data.</span></div></div>`;
      overlay.querySelector(".scan-overlay-close")?.addEventListener("click", () => overlay.remove());
    }
    overlay.querySelector(".scan-overlay-title").textContent = title;
    overlay.querySelector(".scan-overlay-subtitle").textContent = subtitle;
    if (!overlay.isConnected) document.body.appendChild(overlay);
    return overlay;
  }

  function setHomeScanStatus({ progress, title, subtitle, barcode, label, error } = {}) {
    const overlay = showHomeScanOverlay(title || "Scanning your food", subtitle || "We’ll check barcode first, then the Nutrition Facts label if needed.");
    const ring = overlay.querySelector(".scan-ring");
    const card = overlay.querySelector(".scan-overlay-card");
    if (typeof progress === "number") ring?.style.setProperty("--scan-progress", String(Math.max(0, Math.min(100, progress))));
    card?.classList.toggle("scan-error-state", Boolean(error));
    if (barcode) {
      const chip = overlay.querySelector("[data-home-barcode]");
      if (chip) { chip.textContent = barcode.text; chip.className = `scan-chip scan-${barcode.state || "active"}`; }
    }
    if (label) {
      const chip = overlay.querySelector("[data-home-label]");
      if (chip) { chip.textContent = label.text; chip.className = `scan-chip scan-${label.state || "active"}`; }
    }
  }

  async function scanHomePhoto(file) {
    if (!file || homeScanBusy) return;
    homeScanBusy = true;
    try {
      if (typeof window.fileToCompressedDataUrl !== "function") throw new Error("Photo tools are still loading. Refresh and try once more.");
      setHomeScanStatus({ progress: 14, title: "Scanning your food", barcode: { text: "Preparing…", state: "active" }, label: { text: "Waiting", state: "idle" } });
      const imageDataUrl = await window.fileToCompressedDataUrl(file);

      setHomeScanStatus({ progress: 30, barcode: { text: "Scanning…", state: "active" }, label: { text: "Waiting", state: "idle" } });
      const barcodeResponse = await fetch("/foods/barcode-image-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }), credentials: "same-origin" });
      const barcodeData = await barcodeResponse.json().catch(() => ({}));
      const barcode = String(barcodeData.barcode || "").replace(/\D/g, "");
      if (barcodeResponse.ok && barcode) {
        setHomeScanStatus({ progress: 100, barcode: { text: "Barcode found", state: "success" }, label: { text: "Skipped", state: "idle" } });
        window.setTimeout(() => submitHiddenForm("/foods/barcode", { barcode }), 350);
        return;
      }

      setHomeScanStatus({ progress: 48, barcode: { text: "No barcode found", state: "warn" }, label: { text: "Scanning…", state: "active" } });
      const labelResponse = await fetch("/foods/label-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }), credentials: "same-origin" });
      const labelData = await labelResponse.json().catch(() => ({}));
      if (!labelResponse.ok || !labelData.food) throw new Error(labelData.error || "Could not read Nutrition Facts.");
      setHomeScanStatus({ progress: 100, barcode: { text: "No barcode found", state: "warn" }, label: { text: "Nutrition label found", state: "success" } });
      window.setTimeout(() => submitHiddenForm("/foods/confirm-scanned-label", { food: encodePayload(labelData.food) }), 350);
    } catch (error) {
      setHomeScanStatus({ progress: 100, title: "Couldn’t scan this photo", subtitle: error.message || "Try a clearer Nutrition Facts label or barcode.", barcode: { text: "Not found", state: "error" }, label: { text: "Not found", state: "error" }, error: true });
      window.setTimeout(() => document.querySelector(".home-scan-overlay")?.remove(), 2600);
      homeScanBusy = false;
    }
  }

  function wireHomeScanButton(root = document) {
    const scan = root.querySelector?.(".today-action[data-home-scan], .today-action[href='#scan-food']");
    if (!scan || scan.dataset.homeScanDirect === "true") return;
    scan.dataset.homeScanDirect = "true";
    scan.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const input = getHomeScanInput();
      input.value = "";
      input.onchange = () => scanHomePhoto(input.files && input.files[0]);
      input.click();
    }, true);
  }

  function redesignToday() {
    const title = text(document.querySelector("h1")).toLowerCase();
    if (title !== "today" && title !== "home") return;
    if (document.body.dataset.todayDashboard === "true") { wireHomeScanButton(); return; }

    const content = document.querySelector(".content");
    const hero = document.querySelector("section.hero.card");
    if (!content || !hero) return;

    const macros = readMacroData();
    if (!macros.length) return;
    document.body.dataset.todayDashboard = "true";
    addBottomNavIcons();

    const date = text(hero.querySelector(".eyebrow"));
    const calorieText = text(hero.querySelector("h2"));
    const calories = macros.find((m) => /calorie/i.test(m.label));
    const percent = calories?.goal ? Math.max(0, Math.min(100, Math.round((calories.current / calories.goal) * 100))) : 0;
    const next = buildNextMove(macros);

    const dashboard = document.createElement("section");
    dashboard.className = "today-dashboard-card";
    dashboard.innerHTML = `
      <div class="today-hero-block">
        <div class="eyebrow today-date">${date}</div>
        <h2>${calorieText}</h2>
        <div class="today-progress"><span style="width:${percent}%"></span></div>
        <p>${percent}% of daily goal</p>
      </div>
      <div class="today-next-card">
        <div class="section-head"><h2>Next move</h2><span>${next.tag}</span></div>
        <p>${next.copy}</p>
        <div class="today-next-bottom"><a class="button primary" href="/recommendations">Open Meals</a><div class="today-food-plate" aria-hidden="true"><span>🍗</span><span>🥬</span><span>🫐</span></div></div>
      </div>
      <div class="today-action-grid">
        <a class="today-action primary" href="#scan-food" data-home-scan="true"><span>▥</span><strong>Scan food</strong></a>
        <a class="today-action" href="/log"><span>+</span><strong>Log meal</strong></a>
        <a class="today-action" href="/foods"><span>⌕</span><strong>Foods</strong></a>
        <a class="today-action" href="/history"><span>↗</span><strong>Progress</strong></a>
      </div>
      ${macroMarkup(macros)}`;

    hero.remove();
    document.querySelector(".macro-grid")?.remove();
    content.prepend(dashboard);
    wireHomeScanButton(dashboard);

    [...content.querySelectorAll("section.card")].forEach((card) => {
      const heading = text(card.querySelector("h2")).toLowerCase();
      if (heading.includes("meals today") || heading === "weight") card.remove();
    });
  }

  function injectStyles() {
    if (document.getElementById("today-dashboard-style")) return;
    const style = document.createElement("style");
    style.id = "today-dashboard-style";
    style.textContent = `
      body[data-today-dashboard="true"] .content { max-width: 760px; margin: 0 auto; padding-left: 18px; padding-right: 18px; padding-bottom: 132px; }
      .today-dashboard-card { border:1px solid var(--line); border-radius:34px; background:rgba(255,255,255,.74); box-shadow:0 24px 70px rgba(55,38,24,.10); padding:26px; display:grid; gap:20px; }
      [data-theme="dark"] .today-dashboard-card { background:linear-gradient(160deg, rgba(34,38,43,.96), rgba(20,22,26,.98)); box-shadow:0 28px 90px rgba(0,0,0,.45); }
      .today-hero-block h2 { font-size:clamp(42px, 9vw, 62px); letter-spacing:-.07em; line-height:.94; margin:8px 0 18px; }
      .today-date { color:var(--accent); letter-spacing:.24em; font-weight:950; }
      .today-progress { height:18px; border-radius:999px; background:rgba(90,68,48,.08); overflow:hidden; }
      [data-theme="dark"] .today-progress { background:rgba(255,255,255,.08); }
      .today-progress span { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, var(--accent), #e69a74); }
      .today-hero-block p { color:var(--muted); font-size:17px; margin:14px 0 0; }
      .today-next-card { border:1px solid var(--line); border-radius:24px; padding:18px; background:rgba(255,255,255,.48); }
      [data-theme="dark"] .today-next-card { background:rgba(255,255,255,.035); }
      .today-next-card .section-head { align-items:flex-start; margin:0 0 10px; }
      .today-next-card .section-head h2 { margin:0; font-size:24px; }
      .today-next-card .section-head span { color:var(--accent); font-weight:950; font-size:16px; }
      .today-next-card p { font-size:18px; line-height:1.42; color:var(--text); margin:0 0 14px; }
      .today-next-bottom { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; }
      .today-next-bottom .button { min-width:170px; justify-content:center; }
      .today-food-plate { display:flex; gap:0; align-items:flex-end; justify-content:flex-end; font-size:42px; filter:drop-shadow(0 12px 16px rgba(0,0,0,.12)); }
      .today-food-plate span { margin-left:-8px; }
      .today-action-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .today-action { min-height:92px; border:1px solid var(--line); border-radius:22px; background:rgba(255,255,255,.48); display:flex; align-items:center; gap:16px; padding:16px; text-decoration:none; color:var(--text); font-size:19px; font-weight:950; }
      [data-theme="dark"] .today-action { background:rgba(255,255,255,.035); }
      .today-action span { width:52px; height:52px; border-radius:999px; display:grid; place-items:center; background:rgba(199,92,62,.10); color:var(--accent); font-size:24px; }
      .today-action.primary { background:linear-gradient(135deg, #cf6848, #c75436); color:white; border-color:transparent; box-shadow:0 16px 34px rgba(199,92,62,.22); }
      .today-action.primary span { background:rgba(255,255,255,.18); color:white; }
      .today-compact-macros { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .today-macro-stat { border:1px solid var(--line); border-radius:18px; padding:14px; background:rgba(255,255,255,.42); }
      [data-theme="dark"] .today-macro-stat { background:rgba(255,255,255,.035); }
      .today-macro-stat div:first-child { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .today-macro-stat strong { font-size:16px; }
      .today-macro-stat span { color:var(--accent); font-weight:950; font-size:20px; }
      .today-mini-bar { height:10px; border-radius:999px; overflow:hidden; background:rgba(90,68,48,.08); margin:10px 0; }
      [data-theme="dark"] .today-mini-bar { background:rgba(255,255,255,.08); }
      .today-mini-bar i { display:block; height:100%; border-radius:999px; background:var(--accent); }
      .today-macro-stat p { color:var(--muted); margin:0; line-height:1.3; font-size:14px; }
      body[data-today-dashboard="true"] .content > .macro-grid, body[data-today-dashboard="true"] .content > .macro-card { display:none !important; }
      .today-secondary-card { display:none !important; }
    `;
    document.head.appendChild(style);
  }

  function run() { injectStyles(); addBottomNavIcons(); redesignToday(); wireHomeScanButton(); }
  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("pageshow", run);
  window.setTimeout(run, 80);
  window.setTimeout(run, 250);
  window.setTimeout(run, 800);
})();