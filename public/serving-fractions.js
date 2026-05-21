(function () {
  function decodeFoodPayload(payload) {
    try { return JSON.parse(decodeURIComponent(escape(atob(payload)))); }
    catch (error) { return null; }
  }

  function encodeFoodPayload(food) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(food))));
  }

  function niceQty(qty, unit) {
    const num = Number(qty);
    if (!Number.isFinite(num)) return String(qty || 1);
    const cleanUnit = String(unit || "").toLowerCase().trim();
    const canFraction = ["cup", "cups", "c", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons"].includes(cleanUnit);
    if (canFraction) {
      const rounded = Math.round(num * 1000) / 1000;
      const fractions = [[0.25, "1/4"], [0.333, "1/3"], [0.5, "1/2"], [0.667, "2/3"], [0.75, "3/4"]];
      for (const [value, label] of fractions) if (Math.abs(rounded - value) < 0.015) return label;
      const whole = Math.floor(rounded);
      const remainder = Math.round((rounded - whole) * 1000) / 1000;
      for (const [value, label] of fractions) if (whole >= 1 && Math.abs(remainder - value) < 0.015) return `${whole} ${label}`;
    }
    return Number.isInteger(num) ? String(num) : String(Math.round(num * 1000) / 1000).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  function servingText(food) {
    if (food.servingText) return food.servingText;
    return `${niceQty(food.baseQty || 1, food.baseUnit)} ${food.baseUnit || "serving"}`.trim();
  }

  function patchConfirmServing() {
    const form = document.getElementById("confirm-package-form");
    if (!form) return;
    const hidden = form.querySelector("input[name='food']");
    if (!hidden || !hidden.value) return;
    const food = decodeFoodPayload(hidden.value);
    if (!food) return;

    const qtyInput = form.querySelector("input[name='baseQty']");
    const unitInput = form.querySelector("input[name='baseUnit']");
    if (qtyInput && Number.isFinite(Number(food.baseQty))) qtyInput.value = String(Math.round(Number(food.baseQty) * 1000) / 1000);
    if (unitInput && food.baseUnit) unitInput.value = food.baseUnit;

    const lines = [...form.querySelectorAll("p")];
    const line = lines.find((p) => /serving|cup|tbsp|tsp|g\b|ml\b|oz\b/i.test(p.textContent || ""));
    if (line) line.textContent = servingText(food);

    form.addEventListener("submit", () => {
      const current = decodeFoodPayload(hidden.value) || food;
      const updated = {
        ...current,
        baseQty: Number(qtyInput?.value || current.baseQty || 1),
        baseUnit: unitInput?.value || current.baseUnit || "serving"
      };
      if (!updated.servingText) updated.servingText = servingText(updated);
      hidden.value = encodeFoodPayload(updated);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(patchConfirmServing, 0);
  });
})();
