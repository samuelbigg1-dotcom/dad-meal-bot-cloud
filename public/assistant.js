(function () {
  const FALLBACK_TEXT = "I’m not sure yet. I can help with progress, goals, meals, scanning food, custom foods, saved foods, and health scores.";

  function quickAnswer(question) {
    const q = question.toLowerCase();

    if (q.includes("how") && q.includes("doing")) {
      return "Check the Today page first: calories show the overall daily target, and the macro cards show protein, carbs, fat, sugar, and fiber progress. Protein is usually the most important one to watch for muscle gain.";
    }
    if (q.includes("goal") || q.includes("goals")) {
      return "Tap the ⌘ settings icon to view or change calorie and macro goals. Keep changes simple and only adjust goals when progress trends say it makes sense.";
    }
    if (q.includes("protein")) {
      return "Protein progress is shown on Today. If protein is low, use Meals for ideas or log a protein-heavy meal like eggs, Greek yogurt, chicken, tuna, lean beef, or a smoothie.";
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
    if (q.includes("what") && q.includes("eat")) {
      return "Tap Meals or Suggested next on Today. Meal ideas are based on the foods marked available and how the day’s macros are looking.";
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

    addMessage(messages, "bot", "Ask me about progress, goals, meal ideas, food scanning, custom foods, saved foods, or health scores.");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      addMessage(messages, "user", question);
      input.value = "";
      window.setTimeout(() => {
        const answer = quickAnswer(question);
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
