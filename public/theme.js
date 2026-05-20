(function () {
  const STORAGE_KEY = "dadMealTheme";
  const root = document.documentElement;

  const sunSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2.2"></path><path d="M12 19.8V22"></path><path d="M4.9 4.9l1.6 1.6"></path><path d="M17.5 17.5l1.6 1.6"></path><path d="M2 12h2.2"></path><path d="M19.8 12H22"></path><path d="M4.9 19.1l1.6-1.6"></path><path d="M17.5 6.5l1.6-1.6"></path></svg>`;
  const moonSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>`;

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
    for (const icon of icons) icon.innerHTML = safeTheme === "dark" ? sunSvg : moonSvg;
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
