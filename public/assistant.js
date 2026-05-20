(function () {
  const FALLBACK_TEXT = "I’m still learning that one, bro. Try asking about today, what to eat next, protein, sugar, scanning, saved foods, or progress.";

  function text(el) { return el?.textContent?.replace(/\s+/g, " ").trim() || ""; }
  function nums(value) { return (String(value || "").match(/-?\d+(?:\.\d+)?/g) || []).map(Number); }

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
    if (m.percent >= 95) return `${m.label} is basically nailed (${amount(m)}).`;
    if (m.percent >= 80) return `${m.label} is close (${amount(m)}).`;
    if (m.percent < 50) return `${m.label} is still pretty low (${amount(m)}).`;
    return `${m.label} has room left (${amount(m)}).`;
  }

  async function analyzeToday() {
    try {
      const doc = await getTodayDocument();
      const macros = parseMacroCards(doc);
      if (!macros.length) return "I can’t read the Today page yet, bro. Open Today once and ask me again.";
      const calories = macroByName(macros, "Calories");
      const protein = macroByName(macros, "Protein");
      const sugar = macroByName(macros, "Sugar");
      const fiber = macroByName(macros, "Fiber");
      const fat = macroByName(macros, "Fat");
      const carbs = macroByName(macros, "Carbs");
      const notes = [];
      if (calories) notes.push(line(calories));
      if (protein) notes.push(line(protein));
      if (sugar && sugar.percent >= 85) notes.push(sugar.percent >= 105 ? `Sugar is high (${amount(sugar)}).` : `Sugar is creeping up (${amount(sugar)}).`);
      if (fiber && fiber.percent < 70) notes.push(`Fiber is low (${amount(fiber)}).`);
      if (fat && fat.percent >= 105) notes.push(`Fat is over (${amount(fat)}).`);
      if (carbs && carbs.percent >= 105) notes.push(`Carbs are over (${amount(carbs)}).`);
      let next = "";
      if (protein && protein.percent < 90) next = "Move: protein first. Don’t overthink it — hit Meals and pick something simple.";
      else if (sugar && sugar.percent >= 90) next = "Move: keep the next one lower-sugar and higher-protein. Macro tracking does not need to be a whole math exam.";
      else if (calories && calories.percent >= 95) next = "Move: you’re close on calories, so keep the rest light and protein-focused.";
      else next = "Move: you’ve got room. Use Meals for a solid next option from what’s actually available.";
      return `Alright bro, here’s the day so far: ${notes.slice(0, 5).join(" ")} ${next}`;
    } catch (error) {
      return "I couldn’t read today’s totals yet. Open Today and ask me again — easy fix.";
    }
  }

  async function quickAnswer(question) {
    const q = question.toLowerCase();
    if ((q.includes("how") && q.includes("doing")) || q.includes("today") || q.includes("day so far")) return analyzeToday();
    if (q.includes("what") && q.includes("eat")) return `${await analyzeToday()} The Meals tab is the move for actual options.`;
    if (q.includes("goal")) return "Tap the gear to adjust goals. Keep it chill though — change targets based on trends, not one random weird day.";
    if (q.includes("protein")) return "Protein is usually the main macro to save first. If it’s low, go simple: eggs, Greek yogurt, chicken, tuna, lean beef, or a smoothie. Easy win.";
    if (q.includes("sugar")) return "Sugar is sneaky. If it’s already high, next meal should be protein + fiber and less sweet stuff. Nothing dramatic, just clean up the next move.";
    if (q.includes("scan")) return "Tap Scan food, take a clear barcode or Nutrition Facts photo, then confirm it. If confidence looks sketchy, double-check it before saving.";
    if (q.includes("custom") || q.includes("manual") || q.includes("smoothie") || q.includes("homemade")) return "Use Add custom food for homemade stuff, smoothies, or regular meals. Save it once, and future logging gets way less annoying.";
    if (q.includes("fridge") || q.includes("foods") || q.includes("saved")) return "Foods is your personal food library. Save what you actually use, mark what’s available, and Meals can suggest from that.";
    if (q.includes("history") || q.includes("progress") || q.includes("edit") || q.includes("delete") || q.includes("yesterday")) return "Go Progress, tap a day, then edit or delete the meal. Bad logs happen, bro — fix it and move on.";
    if (q.includes("score") || q.includes("health")) return "Health score is a quick quality check. Useful, but don’t worship the number. Calories, macros, and confidence still matter.";
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
    panel.innerHTML = `<div class="assistant-sheet"><div class="assistant-head"><div><strong>Macro buddy</strong><span>Tracking does not have to be overwhelming</span></div><button class="icon-button" type="button" data-assistant-close aria-label="Close assistant">×</button></div><div class="assistant-prompts"><button type="button">How am I doing today?</button><button type="button">What should I eat next?</button><button type="button">Is sugar too high?</button><button type="button">How do I edit a past meal?</button></div><div class="assistant-messages" aria-live="polite"></div><form class="assistant-form"><input class="input" name="question" placeholder="Ask me like a normal person..." autocomplete="off" /><button class="button primary" type="submit">Ask</button></form></div>`;
    document.body.appendChild(panel);
    const messages = panel.querySelector(".assistant-messages");
    const form = panel.querySelector(".assistant-form");
    const input = form.querySelector("input");
    addMessage(messages, "bot", "Yo — I’ll keep this simple. Ask me how the day’s going, what to eat next, or what looks off. Macro tracking doesn’t need to feel like homework.");
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

  document.addEventListener("DOMContentLoaded", buildAssistant);
})();
