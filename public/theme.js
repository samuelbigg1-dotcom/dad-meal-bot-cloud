(function () {
  const STORAGE_KEY = "dadMealTheme";
  const root = document.documentElement;

  function getPreferredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "light";
    } catch (error) {
      return "light";
    }
  }

  function setTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = safeTheme;

    try {
      localStorage.setItem(STORAGE_KEY, safeTheme);
    } catch (error) {
      // Ignore storage errors; the toggle still works for this page load.
    }

    const buttons = document.querySelectorAll("[data-theme-toggle]");
    for (const button of buttons) {
      button.setAttribute("aria-label", safeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      button.setAttribute("title", safeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }

    const labels = document.querySelectorAll("[data-theme-toggle-label]");
    for (const label of labels) label.textContent = safeTheme === "dark" ? "Light" : "Dark";

    const icons = document.querySelectorAll("[data-theme-toggle-icon]");
    for (const icon of icons) icon.textContent = safeTheme === "dark" ? "☀️" : "🌙";
  }

  setTheme(getPreferredTheme());

  document.addEventListener("DOMContentLoaded", () => {
    setTheme(root.dataset.theme || getPreferredTheme());

    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
      button.addEventListener("click", () => {
        setTheme(root.dataset.theme === "dark" ? "light" : "dark");
      });
    }
  });
})();
