(function () {
  const FALLBACK_TEXT = "I’m not sure yet. I can help with progress, goals, meals, scanning food, custom foods, saved foods, and health scores.";

  function text(el) {
    return el?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function parseMacroCards(doc) {
    const cards = [...doc.querySelectorAll(".macro-card")];
    return cards.map((card) => {
      const label = text(card.querySelector(".macro-head span"));
      const percent = Number((text(card.querySelector(".macro-head strong")).match(/-?\d+/) || [0])[0]);
      const values = text(card.querySelector(".macro-values"));
      return { label, percent, values, status: [...card.classList].find((c) => ["low", "ok", "near", "over"].includes(c)) || "" };
    }).filter((m) => m.label);
  }

  async function getTodayDocument() {
    if (text(document.querySelector("h1")).toLowerCase() === "today" && document.querySelector(".macro-card")) return document;
    const response = await fetch("/", { credentials: "same-origin" });
    const html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  function macroByName(macros, name) {
    return macros.find((m) => m.label.toLowerCase() === name.toLowerCase());
  }

  function describeMacro(macro, kind = "normal") {
    if (!macro) return "";
    if (macro.percent >= 105) return `${macro.label} is over target (${macro.values}).`;
    if (macro.percent >= 95) return `${macro.label} is basically met (${macro.values}).`;
    if (macro.percent >= 80) return `${macro.label} is close (${macro.values}).`;
    if (macro.percent < 50) return `${macro.label} is still low (${macro.values}).`;
    return `${macro.label} has room left (${macro.values}).`;
  }

  async function analyzeToday() {
    try {
      const doc = await getTodayDocument();
      const macros = parseMacroCards(doc);
      if (!macros.length) return "I can’t read today’s macro cards yet. Open Today once, then ask me again.";

      const calories = macroByName(macros, "Calories");
      const protein = macroByName(macros, "Protein");
      const carbs = macroByName(macros, "Carbs");
      const fat = macroByName(macros, "Fat");
      const sugar = macroByName(macros, "Sugar");
      const fiber = macroByName(macros, "Fiber");

      const notes = [];
      if (calories) notes.push(describeMacro(calories));
      if (protein) notes.push(describeMacro(protein));
      if (sugar && sugar.percent >= 90) notes.push(`Sugar is ${sugar.percent >= 105 ? "over" : "getting high"} (${sugar.values}).`);
      if (fiber && fiber.percent < 70) notes.push(`Fiber is low (${fiber.values}).`);
      if (fat && fat.percent >= 105) notes.push(`Fat is over target (${fat.values}).`);
      if (carbs && carbs.percent >= 105) notes.push(`Carbs are over target (${carbs.values}).`);

      let next = "";
      if (protein && protein.percent < 90) {
        next = "Best move: prioritize protein next. The Meals tab can suggest something from available foods.";
      } else if (sugar && sugar.percent >= 90) {
        next = "Best move: keep the next meal lower sugar and focus on protein/fiber.";
      } else if (calories && calories.percent >= 95) {
        next = "Best move: you’re close on calories, so keep anything else small and protein-focused.";
      } else {
        next = "Best move: use Suggested next or Meals for a balanced next option based on what’s available.";
      }

      return `${notes.slice(0, 5).join(" ")} ${next}`;
    } catch (error) {
      return "I couldn’t read today’s live totals yet. Try opening the Today page and asking again.";
    }
  }

  async function suggestNextMeal() {
    const reflection = await analyzeToday();
    return `${reflection} Tap Meals to see specific options from the foods marked available.`;
  }

  async function quickAnswer(question) {
    const q = question.toLowerCase();

    if ((q.includes("how") && q.includes("doing")) || q.includes("today") || q.includes("day so far")) {
      return analyzeToday();
    }
    if (q.includes("what") && q.includes("eat")) {
      return suggestNextMeal();
    }
    if (q.includes("goal") || q.includes("goals")) {
      return "Tap the settings gear to view or change calorie and macro goals. Keep changes simple and only adjust goals when progress trends say it makes sense.";
    }
    if (q.includes("protein")) {
      const doc = await getTodayDocument().catch(() => null);
      const protein = doc ? macroByName(parseMacroCards(doc), "Protein") : null;
      if (protein) return `${describeMacro(protein)} If protein is low, use Meals for ideas or log something protein-heavy like eggs, Greek yogurt, chicken, tuna, lean beef, or a smoothie.`;
      return "Protein progress is shown on Today. If protein is low, use Meals for ideas or log a protein-heavy meal.";
    }
    if (q.includes("scan")) {
      return "Tap Scan food, take a clear photo of either the barcode or Nutrition Facts label, then confirm the food. On the confirm screen you can choose Add to fridge, I ate this today, or Both.";
    }
    if (q.includes("custom") || q.includes("manual") || q.includes("smoothie") || q.includes("homemade")) {
      return "Go to Foods, tap Add custom food, then enter the serving size and nutrition. This is best for smoothies, homemade dinners, or regular meals you already know.";
    }
    if (q.includes("fridge") || q.includes("foods") || q.includes("saved")) {
      return "Foods is where saved items live. Search saved foods at the top, scan new foods, add custom foods, or open the ⋯ menu on a saved food to change availability or remove it.";
    }
    if (q.includes("history") || q.includes("progress") || q.includes("week") || q.includes("yesterday")) {
      return "Progress shows recent daily totals and weight entries. The next update will make it easier to tap a day and review exactly what was eaten that day.";
    }
    if (q.includes("score") || q.includes("health")) {
      return "The health score uses barcode nutrition data when available, including Nutri-Score and NOVA processing info from OpenFoodFacts. If barcode data is missing, it uses the scanned nutrition values like calories, sugar, fat, fiber, protein, and sodium when available.";
    }

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
    wrap.innerHTML = `
      <button type="button">How am I doing today?</button>
      <button type="button">What should I eat next?</button>
      <button type="button">How do I scan food?</button>
      <button type="button">How do I add a custom food?</button>
      <button type="button">Why is the health score low?</button>
    `;

    wrap.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.textContent.trim();
        form.requestSubmit();
      });
    });

    list.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
  }

  function buildAssistant() {
    if (document.querySelector(".assistant-panel")) return;

    const panel = document.createElement("aside");
    panel.className = "assistant-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="assistant-sheet">
        <div class="assistant-head">
          <div>
            <strong>Food assistant</strong>
            <span>Read-only helper</span>
          </div>
          <button class="icon-button" type="button" data-assistant-close aria-label="Close assistant">×</button>
        </div>
        <div class="assistant-prompts">
          <button type="button">How am I doing today?</button>
          <button type="button">What should I eat next?</button>
          <button type="button">How do I scan food?</button>
          <button type="button">How do I add a custom food?</button>
        </div>
        <div class="assistant-messages" aria-live="polite"></div>
        <form class="assistant-form">
          <input class="input" name="question" placeholder="Ask about progress, foods, goals..." autocomplete="off" />
          <button class="button primary" type="submit">Ask</button>
        </form>
      </div>
    `;

    document.body.appendChild(panel);

    const messages = panel.querySelector(".assistant-messages");
    const form = panel.querySelector(".assistant-form");
    const input = form.querySelector("input");

    addMessage(messages, "bot", "Ask me how the day is going, what to eat next, or how to use scanning/custom foods.");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      addMessage(messages, "user", question);
      input.value = "";
      const loading = document.createElement("div");
      loading.className = "assistant-message bot assistant-loading";
      loading.textContent = "Checking today...";
      messages.appendChild(loading);
      messages.scrollTop = messages.scrollHeight;

      window.setTimeout(async () => {
        const answer = await quickAnswer(question);
        loading.remove();
        addMessage(messages, "bot", answer);
        if (answer === FALLBACK_TEXT) addFallbackPrompts(messages, form, input);
      }, 120);
    });

    panel.querySelectorAll(".assistant-prompts button").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.textContent.trim();
        form.requestSubmit();
      });
    });

    panel.querySelector("[data-assistant-close]").addEventListener("click", () => {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
    });

    document.querySelectorAll("[data-assistant-open]").forEach((button) => {
      button.addEventListener("click", () => {
        panel.classList.add("open");
        panel.setAttribute("aria-hidden", "false");
        window.setTimeout(() => input.focus(), 80);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", buildAssistant);
})();
