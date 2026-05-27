(function () {
  const LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", late_meal: "Late meal" };

  function timeGuess() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 16) return "lunch";
    if (hour >= 16 && hour < 21) return "dinner";
    if (hour >= 21 || hour < 2) return "late_meal";
    return "snack";
  }

  function looksSnacky(text) {
    const value = String(text || "").toLowerCase();
    const snackWords = ["snack", "bar", "protein bar", "chips", "popcorn", "cookie", "cookies", "chocolate", "candy", "nuts", "almonds", "cashews", "apple", "banana", "yogurt", "cottage cheese", "shake", "smoothie", "muffin"];
    const mealWords = ["steak", "chicken", "rice", "potato", "pasta", "eggs", "toast", "sandwich", "burger", "salmon", "dinner", "lunch", "breakfast"];
    const hasSnack = snackWords.some((word) => value.includes(word));
    const hasMeal = mealWords.some((word) => value.includes(word));
    const shortEntry = value.split(/[,\n]| and | with /).filter(Boolean).length <= 2 && value.length < 80;
    return hasSnack && (!hasMeal || shortEntry);
  }

  function detectMealType(text) {
    return looksSnacky(text) ? "snack" : timeGuess();
  }

  function hideLogSelector() {
    const form = document.querySelector("form[action='/log/analyze']");
    if (!form || form.dataset.autoMealReady === "true") return;
    form.dataset.autoMealReady = "true";
    const label = [...form.querySelectorAll(".field-label")].find((el) => /meal type/i.test(el.textContent || ""));
    const segmented = form.querySelector(".segmented[aria-label='Meal type']");
    if (label) label.hidden = true;
    if (segmented) segmented.hidden = true;
    const textarea = form.querySelector("textarea[name='mealText']");
    const hint = document.createElement("p");
    hint.className = "muted auto-meal-hint";
    hint.textContent = "Meal type is detected automatically from timing and what you ate. You can change it before saving.";
    textarea?.insertAdjacentElement("beforebegin", hint);
    form.addEventListener("submit", () => {
      const detected = detectMealType(textarea?.value || "");
      const fallback = detected === "late_meal" ? "snack" : detected;
      const radio = form.querySelector(`input[name='mealType'][value='${fallback}']`) || form.querySelector("input[name='mealType'][value='snack']");
      if (radio) radio.checked = true;
    });
  }

  function decodePayload(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  }

  function encodePayload(data) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function addConfirmEditor() {
    const form = document.querySelector("form[action='/log/confirm']");
    const payloadInput = form?.querySelector("input[name='payload']");
    if (!form || !payloadInput || form.dataset.mealTypeEditor === "true") return;
    form.dataset.mealTypeEditor = "true";
    let payload;
    try { payload = decodePayload(payloadInput.value); } catch (error) { return; }
    const guessed = detectMealType(payload.rawMessage || "");
    const current = payload?.parsedMeal?.meal_type === "meal" ? guessed : (payload?.parsedMeal?.meal_type || guessed);
    if (!payload.parsedMeal) payload.parsedMeal = {};
    payload.parsedMeal.meal_type = current;
    payloadInput.value = encodePayload(payload);
    const editor = document.createElement("div");
    editor.className = "auto-meal-confirm";
    editor.innerHTML = `<label class="field-label">Looks like</label><select class="input" name="confirmedMealType"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option><option value="late_meal">Late meal</option></select><p class="muted">We guessed this from timing and the meal text. Change it if needed.</p>`;
    const select = editor.querySelector("select");
    select.value = current === "late_breakfast" ? "breakfast" : current;
    form.closest("section.card")?.querySelector(".list")?.insertAdjacentElement("beforebegin", editor);
    const update = () => {
      try {
        const fresh = decodePayload(payloadInput.value);
        if (!fresh.parsedMeal) fresh.parsedMeal = {};
        fresh.parsedMeal.meal_type = select.value;
        payloadInput.value = encodePayload(fresh);
      } catch (error) {}
    };
    select.addEventListener("change", update);
    form.addEventListener("submit", update);
  }

  function polishFlexibleLabel() {
    if ((document.querySelector("h1")?.textContent || "").trim().toLowerCase() !== "settings") return;
    for (const tile of document.querySelectorAll(".settings-tile")) {
      const key = tile.querySelector("span")?.textContent?.trim().toLowerCase();
      const value = tile.querySelector("strong");
      if (!key || !value) continue;
      const raw = value.textContent.trim().toLowerCase();
      if (key === "eating style" && ["meals snacks", "meals + snacks", "meals_snacks", "not sure"].includes(raw)) value.textContent = "Flexible";
    }
  }

  function injectStyles() {
    if (document.getElementById("log-auto-meal-style")) return;
    const style = document.createElement("style");
    style.id = "log-auto-meal-style";
    style.textContent = `.auto-meal-hint{margin-top:0}.auto-meal-confirm{border:1px solid var(--line);border-radius:20px;padding:14px;margin:0 0 14px;background:var(--card2)}.auto-meal-confirm .input{margin-top:8px}.auto-meal-confirm p{margin:8px 0 0}`;
    document.head.appendChild(style);
  }

  function run() {
    injectStyles();
    hideLogSelector();
    addConfirmEditor();
    polishFlexibleLabel();
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("pageshow", run);
  window.setTimeout(run, 250);
  window.setTimeout(run, 750);
})();
