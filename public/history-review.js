(function () {
  function keepBackendReview() {
    const card = document.querySelector(".selected-day-card");
    if (!card) return;
    // Backend-rendered review now owns selected-day meals, including Edit/Delete.
    // No-op so this file does not overwrite those controls.
  }
  document.addEventListener("DOMContentLoaded", keepBackendReview);
})();
