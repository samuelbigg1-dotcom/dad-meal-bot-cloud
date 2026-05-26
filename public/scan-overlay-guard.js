(function () {
  const originalRemove = Element.prototype.remove;

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

  function markCloseState(overlay) {
    const card = overlay?.querySelector?.(".scan-overlay-card");
    if (!card) return;
    let close = card.querySelector(".scan-overlay-close");
    if (!close) {
      close = document.createElement("button");
      close.type = "button";
      close.className = "scan-overlay-close";
      close.setAttribute("aria-label", "Close scan status");
      close.textContent = "×";
      close.addEventListener("click", () => {
        overlay.dataset.allowClose = "true";
        originalRemove.call(overlay);
      });
      card.prepend(close);
    }
    const failed = card.classList.contains("scan-error-state") || /couldn.t scan|not found|try a clearer/i.test(card.textContent || "");
    close.hidden = !failed;
    overlay.dataset.holdOnFailure = failed ? "true" : "false";
  }

  Element.prototype.remove = function guardedRemove() {
    if (this.classList?.contains("scan-overlay") && this.dataset.holdOnFailure === "true" && this.dataset.allowClose !== "true") {
      markCloseState(this);
      return;
    }
    return originalRemove.call(this);
  };

  function watch() {
    injectStyles();
    document.querySelectorAll(".scan-overlay").forEach(markCloseState);
  }

  const observer = new MutationObserver(watch);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  document.addEventListener("DOMContentLoaded", watch);
  watch();
})();
