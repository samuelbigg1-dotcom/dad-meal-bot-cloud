(function () {
  function text(el) { return (el?.textContent || "").replace(/\s+/g, " ").trim(); }
  function parseNumber(value) { const match = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return match ? Number(match[0]) : 0; }

  function macroData(card) {
    const label = card?.dataset?.macro || text(card?.querySelector(".macro-head span"));
    const values = [...card.querySelectorAll(".macro-values span")].map(text);
    const first = values[0] || "";
    const [currentRaw, goalRaw] = first.split("/").map((part) => part || "");
    return { label, current: parseNumber(currentRaw), goal: parseNumber(goalRaw), unit: /cal/i.test(first) || label === "Calories" ? "cal" : "g", card };
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

  function redesignToday() {
    const title = text(document.querySelector("h1")).toLowerCase();
    if (title !== "today" && title !== "home") return;
    if (document.body.dataset.todayDashboard === "true") return;
    document.body.dataset.todayDashboard = "true";
    addBottomNavIcons();

    const content = document.querySelector(".content");
    const hero = document.querySelector("section.hero.card");
    const macroGrid = document.querySelector(".macro-grid");
    if (!content || !hero || !macroGrid) return;

    const date = text(hero.querySelector(".eyebrow"));
    const calorieText = text(hero.querySelector("h2"));
    const macros = [...macroGrid.querySelectorAll(".macro-card")].map(macroData);
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
        <a class="today-action primary" href="#scan-food"><span>▥</span><strong>Scan food</strong></a>
        <a class="today-action" href="/log"><span>+</span><strong>Log meal</strong></a>
        <a class="today-action" href="/foods"><span>⌕</span><strong>Foods</strong></a>
        <a class="today-action" href="/history"><span>↗</span><strong>Progress</strong></a>
      </div>`;

    hero.remove();
    macroGrid.remove();
    content.prepend(dashboard);

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
      .today-action { min-height:112px; border:1px solid var(--line); border-radius:22px; background:rgba(255,255,255,.48); display:flex; align-items:center; gap:16px; padding:18px; text-decoration:none; color:var(--text); font-size:20px; font-weight:950; }
      [data-theme="dark"] .today-action { background:rgba(255,255,255,.035); }
      .today-action span { width:54px; height:54px; border-radius:999px; display:grid; place-items:center; background:rgba(199,92,62,.10); color:var(--accent); font-size:24px; }
      .today-action.primary { background:linear-gradient(135deg, #cf6848, #c75436); color:white; border-color:transparent; box-shadow:0 16px 34px rgba(199,92,62,.22); }
      .today-action.primary span { background:rgba(255,255,255,.18); color:white; }
      .today-compact-macros, body[data-today-dashboard="true"] .content > .macro-grid, body[data-today-dashboard="true"] .macro-card { display:none !important; }
      .today-secondary-card { display:none !important; }
      .bottom-nav { left:50% !important; transform:translateX(-50%); width:min(760px, calc(100vw - 28px)); border-radius:34px; bottom:calc(14px + env(safe-area-inset-bottom)); padding:8px 10px !important; box-shadow:0 20px 70px rgba(55,38,24,.14); }
      .bottom-nav a { display:flex !important; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:60px; border-radius:26px; font-size:13px; padding:8px 4px; }
      .bottom-nav a .nav-icon { font-size:25px; line-height:1; font-weight:400; }
      .bottom-nav a .nav-label { font-weight:850; }
      .bottom-nav a.active { transform:translateY(-14px); min-height:76px; border-radius:30px; background:linear-gradient(135deg, #cf6848, #c75436) !important; color:white !important; box-shadow:0 16px 34px rgba(199,92,62,.25); border:6px solid var(--bg); min-width:118px; }
      .bottom-nav a.active .nav-icon { font-size:31px; }
      .bottom-nav a.active .nav-label { font-size:15px; }
      @media (max-width:560px){
        body[data-today-dashboard="true"] .content { padding-left:14px; padding-right:14px; }
        .today-dashboard-card { padding:20px; border-radius:30px; gap:16px; }
        .today-action { min-height:92px; padding:14px; font-size:18px; }
        .today-action span { width:48px; height:48px; }
        .today-next-bottom { align-items:center; }
        .today-food-plate { font-size:32px; }
        .bottom-nav { width:calc(100vw - 20px); }
        .bottom-nav a.active { min-width:104px; }
      }
    `;
    document.head.appendChild(style);
  }

  function run() { injectStyles(); addBottomNavIcons(); redesignToday(); }
  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("pageshow", run);
  window.setTimeout(run, 80);
  window.setTimeout(run, 250);
  window.setTimeout(run, 800);
})();
