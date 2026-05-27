(function () {
  const FRACTIONS = [
    [0.125, "1/8"],
    [0.167, "1/6"],
    [0.2, "1/5"],
    [0.25, "1/4"],
    [0.333333, "1/3"],
    [0.375, "3/8"],
    [0.5, "1/2"],
    [0.625, "5/8"],
    [0.667, "2/3"],
    [0.75, "3/4"],
    [0.875, "7/8"]
  ];

  const UNITS = new Set(["cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons", "serving", "servings", "scoop", "scoops", "slice", "slices", "oz", "fl oz", "ml", "g"]);

  function mixedFraction(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const whole = Math.floor(n);
    const decimal = n - whole;
    if (decimal < 0.015) return String(whole);
    let best = null;
    for (const [amount, label] of FRACTIONS) {
      const diff = Math.abs(decimal - amount);
      if (diff <= 0.025 && (!best || diff < best.diff)) best = { label, diff };
    }
    if (!best) return null;
    return whole > 0 ? `${whole} ${best.label}` : best.label;
  }

  function formatLeadingAmount(text) {
    return text.replace(/^\s*(\d*\.\d{2,}|\d+\.\d{2,})\s+([a-zA-Z][a-zA-Z ]*?)(\s*[•·-]|$)/, (match, num, unit, tail) => {
      const normalizedUnit = unit.trim().toLowerCase();
      if (!UNITS.has(normalizedUnit)) return match;
      const fraction = mixedFraction(num);
      if (!fraction) return match;
      return `${fraction} ${unit.trim()}${tail}`;
    });
  }

  function polishServingText() {
    const title = document.querySelector("h1")?.textContent?.trim().toLowerCase() || "";
    if (!title.includes("foods")) return;
    for (const row of document.querySelectorAll(".food-row p, .food-row small, .list-row p")) {
      const before = row.textContent || "";
      const after = formatLeadingAmount(before);
      if (after !== before) row.textContent = after;
    }
  }

  document.addEventListener("DOMContentLoaded", polishServingText);
  window.addEventListener("pageshow", polishServingText);
  window.setTimeout(polishServingText, 150);
})();
