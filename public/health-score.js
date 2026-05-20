(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value) {
    return Math.round(Number(value || 0));
  }

  function scoreLabel(score) {
    if (score >= 80) return "Strong choice";
    if (score >= 60) return "Pretty balanced";
    if (score >= 40) return "Okay sometimes";
    if (score >= 20) return "Treat food";
    return "Low nutrition score";
  }

  function gradeToScore(grade) {
    const map = { a: 90, b: 75, c: 55, d: 35, e: 15 };
    return map[String(grade || "").toLowerCase()] || null;
  }

  function extractBarcode(food) {
    const text = `${food?.aliases || ""} ${food?.barcode || ""}`;
    const match = text.match(/\b\d{8,14}\b/);
    return match ? match[0] : "";
  }

  function nutritionFormula(food, nutriments = {}) {
    const calories = Number(food.calories ?? nutriments["energy-kcal_serving"] ?? nutriments["energy-kcal_100g"] ?? 0);
    const protein = Number(food.protein ?? nutriments.proteins_serving ?? nutriments.proteins_100g ?? 0);
    const sugar = Number(food.sugar ?? nutriments.sugars_serving ?? nutriments.sugars_100g ?? 0);
    const fiber = Number(food.fiber ?? nutriments.fiber_serving ?? nutriments.fiber_100g ?? 0);
    const fat = Number(food.fat ?? nutriments.fat_serving ?? nutriments.fat_100g ?? 0);
    const saturatedFat = Number(nutriments["saturated-fat_serving"] ?? nutriments["saturated-fat_100g"] ?? 0);
    const sodiumMg = Number(nutriments.sodium_serving ? nutriments.sodium_serving * 1000 : nutriments.sodium_100g ? nutriments.sodium_100g * 1000 : nutriments.salt_serving ? nutriments.salt_serving * 400 : nutriments.salt_100g ? nutriments.salt_100g * 400 : 0);

    let score = 82;
    score -= clamp((calories - 180) / 8, 0, 24);
    score -= clamp((sugar - 6) * 2.8, 0, 26);
    score -= clamp((fat - 10) * 1.4, 0, 18);
    score -= clamp(saturatedFat * 3.2, 0, 18);
    score -= clamp((sodiumMg - 250) / 35, 0, 22);
    score += clamp(protein * 1.2, 0, 12);
    score += clamp(fiber * 2.4, 0, 14);

    const reasons = [];
    if (calories > 300) reasons.push("higher calorie serving");
    if (sugar > 12) reasons.push("higher sugar");
    if (fat > 16) reasons.push("higher fat");
    if (sodiumMg > 450) reasons.push("higher sodium");
    if (protein >= 12) reasons.push("good protein");
    if (fiber >= 4) reasons.push("good fiber");

    return {
      score: clamp(round(score), 0, 100),
      source: "Nutrition values",
      detail: reasons.length ? reasons.join(" • ") : "based on calories, protein, sugar, fat, fiber, and sodium when available"
    };
  }

  async function getOpenFoodFactsScore(food) {
    const barcode = extractBarcode(food);
    if (!barcode) return null;

    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=nutriscore_grade,nutriscore_score,nova_group,nutriments`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const product = data.product || {};
    const nutriments = product.nutriments || {};

    const gradeScore = gradeToScore(product.nutriscore_grade);
    if (gradeScore != null) {
      const novaPenalty = product.nova_group ? clamp((Number(product.nova_group) - 1) * 6, 0, 18) : 0;
      return {
        score: clamp(round(gradeScore - novaPenalty), 0, 100),
        source: `OpenFoodFacts Nutri-Score ${String(product.nutriscore_grade).toUpperCase()}${product.nova_group ? ` • NOVA ${product.nova_group}` : ""}`,
        detail: "uses public product nutrition scoring data when barcode data is available"
      };
    }

    return nutritionFormula(food, nutriments);
  }

  function renderScore(container, result) {
    container.innerHTML = `
      <div class="health-score-ring"><strong>${result.score}</strong><span>/100</span></div>
      <div>
        <strong>${scoreLabel(result.score)}</strong>
        <p>${result.source}</p>
        <small>${result.detail}</small>
      </div>
    `;
  }

  async function addHealthScoreToConfirmation() {
    const form = document.getElementById("confirm-package-form");
    if (!form || form.querySelector(".health-score-card")) return;
    const hidden = form.querySelector("input[name='food']");
    if (!hidden || typeof decodeFoodPayload !== "function") return;

    let food;
    try {
      food = decodeFoodPayload(hidden.value);
    } catch (error) {
      return;
    }

    const card = document.createElement("div");
    card.className = "health-score-card";
    card.innerHTML = `<div class="health-score-ring"><strong>…</strong><span>/100</span></div><div><strong>Health score</strong><p>Checking nutrition data...</p><small>Score is guidance only, not medical advice.</small></div>`;

    const saveMode = form.querySelector(".scan-save-mode");
    const actions = form.querySelector(".action-row");
    form.insertBefore(card, saveMode || actions || null);

    const fallback = nutritionFormula(food);
    renderScore(card, fallback);

    try {
      const better = await getOpenFoodFactsScore(food);
      if (better) renderScore(card, better);
    } catch (error) {
      renderScore(card, fallback);
    }
  }

  document.addEventListener("DOMContentLoaded", addHealthScoreToConfirmation);
})();
