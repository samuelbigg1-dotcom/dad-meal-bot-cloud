(function () {
  const FALLBACK_TEXT = "I’m still learning that one. Try asking about today, what to eat next, protein, sugar, scanning, saved foods, or progress.";

  function text(el) { return el?.textContent?.replace(/\s+/g, " ").trim() || ""; }
  function nums(value) { return (String(value || "").match(/-?\d+(?:\.\d+)?/g) || []).map(Number); }

  function isBlankScannedFood(food) {
    if (!food) return true;
    const numbers = [food.calories, food.protein, food.carbs, food.fat, food.sugar, food.fiber].map((v) => Number(v || 0));
    const total = numbers.reduce((sum, n) => sum + (Number.isFinite(n) ? Math.abs(n) : 0), 0);
    const name = String(food.name || "").toLowerCase().trim();
    const genericName = !name || name === "scanned packaged food" || name === "packaged food";
    return total <= 0 || (genericName && Number(food.calories || 0) <= 0);
  }

  function decodePayload(value) {
    try { return JSON.parse(decodeURIComponent(escape(atob(value)))); } catch (error) { return null; }
  }

  function installScanGuards() {
    if (window.__scanZeroGuardInstalled) return;
    window.__scanZeroGuardInstalled = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async function guardedFetch(input, init) {
      const response = await originalFetch(input, init);
      const url = typeof input === "string" ? input : input?.url || "";
      if (!url.includes("/foods/label-scan")) return response;
      const clone = response.clone();
      let data = null;
      try { data = await clone.json(); } catch (error) { return response; }
      if (response.ok && data?.food && isBlankScannedFood(data.food)) {
        const body = JSON.stringify({ error: "That photo does not look like a readable Nutrition Facts label. Try a clearer label photo or scan the barcode." });
        return new Response(body, { status: 422, headers: { "Content-Type": "application/json" } });
      }
      return response;
    };
  }

  function blockBlankConfirmSave() {
    const form = document.getElementById("confirm-package-form");
    if (!form || form.dataset.blankGuard === "true") return;
    form.dataset.blankGuard = "true";
    form.addEventListener("submit", (event) => {
      const hidden = form.querySelector("input[name='food']");
      const food = hidden ? decodePayload(hidden.value) : null;
      if (!isBlankScannedFood(food)) return;
      event.preventDefault();
      let warning = form.querySelector(".blank-scan-warning");
      if (!warning) {
        warning = document.createElement("p");
        warning.className = "flash error blank-scan-warning";
        warning.textContent = "This scan did not find real nutrition data, so it was not saved. Try a clearer Nutrition Facts label or scan the barcode.";
        form.insertBefore(warning, form.firstChild);
      }
      warning.scrollIntoView({ behavior: "smooth", block: "center" });
    }, true);
  }

  function parseMacroCards(doc) {
    return [...doc.querySelectorAll(".macro-card")].map((card) => {
      const label = text(card.querySelector(".macro-head span"));
      const percent = Number((text(card.querySelector(".macro-head strong")).match(/-?\d+/) || [0])[0]);
      const valueNums = nums(text(card.querySelector(".macro-values span:first-child")));
      return { label, percent, current: valueNums[0] || 0, goal: valueNums[1] || 0 };
    }).filter((m) => m.label);
  }

  async function getTodayDocument() {
    if (text(document.querySelector("h1")).toLowerCase() === "today" && document.querySelector(".macro-card")) return document;
    const response = await fetch("/", { credentials: "same-origin" });
    return new DOMParser().parseFromString(await response.text(), "text/html");
  }

  function macroByName(macros, name) { return macros.find((m) => m.label.toLowerCase() === name.toLowerCase()); }
  function amount(m) { return `${m.current}${m.label === "Calories" ? " cal" : "g"} / ${m.goal}${m.label === "Calories" ? " cal" : "g"}`; }

  function line(m) {
    if (!m) return "";
    if (m.percent >= 105) return `${m.label} is over target (${amount(m)}).`;
    if (m.percent >= 95) return `${m.label} is right on track (${amount(m)}).`;
    if (m.percent >= 80) return `${m.label} is close (${amount(m)}).`;
    if (m.percent < 50) return `${m.label} still has plenty of room (${amount(m)}).`;
    return `${m.label} has room left (${amount(m)}).`;
  }

  async function analyzeToday() {
    try {
      const doc = await getTodayDocument();
      const macros = parseMacroCards(doc);
      if (!macros.length) return "I can’t read the Today page yet. Open Today once and ask me again.";
      const calories = macroByName(macros, "Calories");
      const protein = macroByName(macros, "Protein");
      const sugar = macroByName(macros, "Sugar");
      const fiber = macroByName(macros, "Fiber");
      const fat = macroByName(macros, "Fat");
      const carbs = macroByName(macros, "Carbs");
      const notes = [];
      if (calories) notes.push(line(calories));
      if (protein) notes.push(line(protein));
      if (sugar && sugar.percent >= 85) notes.push(sugar.percent >= 105 ? `Sugar is high (${amount(sugar)}).` : `Sugar is getting close (${amount(sugar)}).`);
      if (fiber && fiber.percent < 70) notes.push(`Fiber could use a boost (${amount(fiber)}).`);
      if (fat && fat.percent >= 105) notes.push(`Fat is over target (${amount(fat)}).`);
      if (carbs && carbs.percent >= 105) notes.push(`Carbs are over target (${amount(carbs)}).`);
      let next = "";
      if (protein && protein.percent < 90) next = "Next step: protein first. Open Meals for a simple option that helps move the day closer to your goals.";
      else if (sugar && sugar.percent >= 90) next = "Next step: keep the next meal lower in sugar and higher in protein or fiber.";
      else if (calories && calories.percent >= 95) next = "Next step: you’re close on calories, so keep the rest lighter and protein-focused.";
      else next = "Next step: you have room. Meals can suggest something realistic from what’s available.";
      return `Here’s the day so far: ${notes.slice(0, 5).join(" ")} ${next}`;
    } catch (error) {
      return "I couldn’t read today’s totals yet. Open Today and ask me again.";
    }
  }

  async function quickAnswer(question) {
    const q = question.toLowerCase();
    if ((q.includes("how") && q.includes("doing")) || q.includes("today") || q.includes("day so far")) return analyzeToday();
    if (q.includes("what") && q.includes("eat")) return `${await analyzeToday()} The Meals tab will show real options based on what’s available.`;
    if (q.includes("goal")) return "Tap the gear to adjust goals. Small changes are best when they’re based on trends, not one unusual day.";
    if (q.includes("protein")) return "Protein is usually the main macro to protect. If it’s low, keep it simple: eggs, Greek yogurt, chicken, tuna, lean beef, cottage cheese, or a smoothie.";
    if (q.includes("sugar")) return "If sugar is already high, make the next meal protein and fiber focused. Simple choices can bring the day back on track.";
    if (q.includes("scan")) return "Tap Scan food, take a clear barcode or Nutrition Facts photo, then confirm it before saving. If confidence looks low, give it a quick check.";
    if (q.includes("custom") || q.includes("manual") || q.includes("smoothie") || q.includes("homemade")) return "Use Add custom food for homemade meals, smoothies, or regular items. Save it once, and future logging gets easier.";
    if (q.includes("fridge") || q.includes("foods") || q.includes("saved")) return "Foods is your saved food list. Add what you actually use, mark what’s available, and Meals can build better ideas from it.";
    if (q.includes("history") || q.includes("progress") || q.includes("edit") || q.includes("delete") || q.includes("yesterday")) return "Go to Progress, tap a day, then edit or delete the meal. It’s there so the log stays easy to fix.";
    if (q.includes("score") || q.includes("health")) return "Health score is a quick quality check. It’s useful, but calories, macros, and confidence still matter most.";
    return FALLBACK_TEXT;
  }

  function addMessage(list, role, text) {
    const item = document.createElement("div");
    item.className = `assistant-message ${role}`;
    item.textContent = text;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
  }

  function addFallbackPrompts(list, form, input) {
    const wrap = document.createElement("div");
    wrap.className = "assistant-suggestions";
    wrap.innerHTML = `<button type="button">How am I doing today?</button><button type="button">What should I eat next?</button><button type="button">Is sugar too high?</button><button type="button">How do I scan food?</button><button type="button">How do I edit a past meal?</button>`;
    wrap.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { input.value = button.textContent.trim(); form.requestSubmit(); }));
    list.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
  }

  function buildAssistant() {
    if (document.querySelector(".assistant-panel")) return;
    const panel = document.createElement("aside");
    panel.className = "assistant-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `<div class="assistant-sheet"><div class="assistant-head"><div><strong>Food helper</strong><span>Simple help for meals, macros, and progress</span></div><button class="icon-button" type="button" data-assistant-close aria-label="Close assistant">×</button></div><div class="assistant-prompts"><button type="button">How am I doing today?</button><button type="button">What should I eat next?</button><button type="button">Is sugar too high?</button><button type="button">How do I edit a past meal?</button></div><div class="assistant-messages" aria-live="polite"></div><form class="assistant-form"><input class="input" name="question" placeholder="Ask about meals, goals, or progress..." autocomplete="off" /><button class="button primary" type="submit">Ask</button></form></div>`;
    document.body.appendChild(panel);
    const messages = panel.querySelector(".assistant-messages");
    const form = panel.querySelector(".assistant-form");
    const input = form.querySelector("input");
    addMessage(messages, "bot", "I’ll keep it simple. Ask how the day is going, what to eat next, or what looks off. Macros don’t have to feel overwhelming.");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      addMessage(messages, "user", question);
      input.value = "";
      const loading = document.createElement("div");
      loading.className = "assistant-message bot assistant-loading";
      loading.textContent = "One sec, checking the day...";
      messages.appendChild(loading);
      messages.scrollTop = messages.scrollHeight;
      window.setTimeout(async () => {
        const answer = await quickAnswer(question);
        loading.remove();
        addMessage(messages, "bot", answer);
        if (answer === FALLBACK_TEXT) addFallbackPrompts(messages, form, input);
      }, 120);
    });
    panel.querySelectorAll(".assistant-prompts button").forEach((button) => button.addEventListener("click", () => { input.value = button.textContent.trim(); form.requestSubmit(); }));
    panel.querySelector("[data-assistant-close]").addEventListener("click", () => { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); });
    document.querySelectorAll("[data-assistant-open]").forEach((button) => button.addEventListener("click", () => { panel.classList.add("open"); panel.setAttribute("aria-hidden", "false"); window.setTimeout(() => input.focus(), 80); }));
  }

  installScanGuards();
  document.addEventListener("DOMContentLoaded", () => {
    buildAssistant();
    blockBlankConfirmSave();
  });
})();
