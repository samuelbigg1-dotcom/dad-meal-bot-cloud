(function () {
  function removeTodayWeightCard() {
    const title = document.querySelector("h1")?.textContent?.trim().toLowerCase();
    if (title !== "today") return;
    for (const card of document.querySelectorAll("section.card")) {
      const heading = card.querySelector("h2")?.textContent?.trim().toLowerCase();
      const weightForm = card.querySelector("form[action='/weight']");
      if (heading === "weight" || weightForm) card.remove();
    }
  }

  document.addEventListener("DOMContentLoaded", removeTodayWeightCard);
  window.addEventListener("pageshow", removeTodayWeightCard);
})();
