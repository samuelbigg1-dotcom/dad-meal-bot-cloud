(function () {
  let savedFailedOverlayHtml = "";
  let userClosedFailure = false;

  function injectStyles() {
    if (document.getElementById("scan-overlay-guard-style")) return;
    const style = document.createElement("style");
    style.id = "scan-overlay-guard-style";
    style.textContent = `
      .scan-overlay-card { position: relative; }
      .scan-overlay-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 999px;
        background: rgba(255,255,255,.05);
        color: var(--text, #f6f1ea);
        font-size: 28px;
        line-height: 1;
        display: grid;
        place-items: center;
        cursor: pointer;
        z-index: 2;
        -webkit-tap-highlight-color: transparent;
      }
      .scan-overlay-close:active { transform: scale(.96); }
      .scan-overlay-close[hidden] { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function isFailedScanOverlay(overlay) {
    const card = overlay?.querySelector?.(".scan-overlay-card");
    if (!card) return false;
    const body = `${card.textContent || ""}`.toLowerCase();
    return card.classList.contains("scan-error-state") || body.includes("couldn") || body.includes("not found") || body.includes("try a clearer") || body.includes("could not read");
  }

  function addCloseButton(overlay) {
    const card = overlay?.querySelector?.(".scan-overlay-card");
    if (!card) return;
    let close = card.querySelector(".scan-overlay-close");
    if (!close) {
      close = document.createElement("button");
      close.type = "button";
      close.className = "scan-overlay-close";
      close.setAttribute("aria-label", "Close scan status");
      close.textContent = "×";
      card.prepend(close);
    }
    close.hidden = false;
    close.onclick = () => {
      userClosedFailure = true;
      savedFailedOverlayHtml = "";
      overlay.remove();
    };
  }

  function restoreFailedOverlay() {
    if (userClosedFailure || !savedFailedOverlayHtml || document.querySelector(".scan-overlay")) return;
    const restored = document.createElement("div");
    restored.className = "scan-overlay";
    restored.setAttribute("role", "status");
    restored.setAttribute("aria-live", "polite");
    restored.innerHTML = savedFailedOverlayHtml;
    document.body.appendChild(restored);
    addCloseButton(restored);
  }

  function watch() {
    injectStyles();
    const overlay = document.querySelector(".scan-overlay");
    if (!overlay) return restoreFailedOverlay();

    if (isFailedScanOverlay(overlay)) {
      addCloseButton(overlay);
      savedFailedOverlayHtml = overlay.innerHTML;
      userClosedFailure = false;
    } else {
      const close = overlay.querySelector(".scan-overlay-close");
      if (close) close.hidden = true;
    }
  }

  const observer = new MutationObserver(watch);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  document.addEventListener("DOMContentLoaded", watch);
  window.setInterval(watch, 100);
  watch();
})();
