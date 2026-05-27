(function () {
  let savedFailedOverlayHtml = "";
  let userClosedFailure = false;

  function injectStyles() {
    if (document.getElementById("scan-overlay-guard-style")) return;
    const style = document.createElement("style");
    style.id = "scan-overlay-guard-style";
    style.textContent = `
      .scan-overlay {
        position: fixed !important;
        inset: 0 !important;
        z-index: 99999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 22px !important;
        background: rgba(0,0,0,.62) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
      }
      .scan-overlay-card {
        position: relative !important;
        width: min(100%, 540px) !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 34px !important;
        padding: 32px 28px 28px !important;
        background: linear-gradient(160deg, rgba(31,35,40,.98), rgba(15,17,21,.98)) !important;
        box-shadow: 0 28px 90px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.05) !important;
        color: #f7f2eb !important;
        text-align: center !important;
      }
      .scan-ring {
        --scan-progress: 6;
        position: relative !important;
        width: 138px !important;
        height: 138px !important;
        margin: 0 auto 20px !important;
        border-radius: 999px !important;
        display: grid !important;
        place-items: center !important;
        background: conic-gradient(var(--accent, #d87b55) calc(var(--scan-progress) * 1%), rgba(255,255,255,.08) 0) !important;
        filter: drop-shadow(0 0 22px rgba(216,123,85,.18)) !important;
        transition: background .45s ease !important;
      }
      .scan-ring::before {
        content: "";
        position: absolute;
        inset: 10px;
        border-radius: inherit;
        background: #17191d;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.05);
      }
      .scan-ring-icon {
        position: relative !important;
        z-index: 1 !important;
        width: 58px !important;
        height: 58px !important;
        display: grid !important;
        place-items: center !important;
        color: var(--accent, #d87b55) !important;
        font-size: 54px !important;
        font-weight: 900 !important;
      }
      .scan-ring-icon svg { width: 100% !important; height: 100% !important; display: block !important; }
      .scan-overlay-title {
        margin: 0 0 8px !important;
        font-size: clamp(28px, 7vw, 42px) !important;
        letter-spacing: -.055em !important;
        line-height: 1 !important;
        color: #ffffff !important;
        opacity: 1 !important;
      }
      .scan-overlay-subtitle {
        margin: 0 auto 24px !important;
        max-width: 320px !important;
        color: rgba(247,242,235,.78) !important;
        font-size: 16px !important;
        line-height: 1.45 !important;
        opacity: 1 !important;
      }
      .scan-step-list {
        display: grid !important;
        gap: 12px !important;
        margin: 0 auto 22px !important;
        max-width: 430px !important;
      }
      .scan-step {
        display: grid !important;
        grid-template-columns: 42px 1fr auto !important;
        gap: 12px !important;
        align-items: center !important;
        min-height: 66px !important;
        border: 1px solid rgba(255,255,255,.07) !important;
        border-radius: 999px !important;
        padding: 10px 14px 10px 10px !important;
        background: rgba(255,255,255,.025) !important;
        text-align: left !important;
        position: relative !important;
      }
      .scan-step + .scan-step::before {
        content: "";
        position: absolute;
        left: 31px;
        top: -13px;
        width: 1px;
        height: 14px;
        background: linear-gradient(var(--accent, #d87b55), transparent);
        opacity: .55;
      }
      .scan-step-num {
        width: 42px !important;
        height: 42px !important;
        border-radius: 999px !important;
        display: grid !important;
        place-items: center !important;
        font-weight: 950 !important;
        background: rgba(255,255,255,.055) !important;
        color: #f7f2eb !important;
        border: 1px solid rgba(255,255,255,.08) !important;
      }
      .scan-step-label {
        font-size: 15px !important;
        font-weight: 950 !important;
        letter-spacing: -.02em !important;
        color: #ffffff !important;
      }
      .scan-chip {
        border-radius: 999px !important;
        padding: 7px 10px !important;
        font-size: 12px !important;
        font-weight: 950 !important;
        white-space: nowrap !important;
        background: rgba(255,255,255,.05) !important;
        color: rgba(247,242,235,.72) !important;
        opacity: 1 !important;
      }
      .scan-chip.scan-active { color: var(--accent, #d87b55) !important; background: rgba(216,123,85,.12) !important; }
      .scan-chip.scan-success { color: #9bd6a0 !important; background: rgba(75,160,95,.13) !important; }
      .scan-chip.scan-warn { color: #f2a27f !important; background: rgba(216,123,85,.13) !important; }
      .scan-chip.scan-error { color: #ffb0a8 !important; background: rgba(220,70,60,.16) !important; }
      .scan-footer {
        margin: 2px auto 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        max-width: 360px !important;
        color: rgba(247,242,235,.72) !important;
        line-height: 1.42 !important;
      }
      .scan-footer-star { color: var(--accent, #d87b55) !important; font-size: 24px !important; }
      .scan-overlay-card.scan-error-state .scan-ring { background: conic-gradient(#e56b5f calc(var(--scan-progress) * 1%), rgba(255,255,255,.08) 0) !important; }
      .scan-overlay-card h2, .scan-overlay-card h3, .scan-overlay-card strong { color:#ffffff !important; opacity:1 !important; }
      .scan-overlay-card p, .scan-overlay-card span, .scan-overlay-card .muted { opacity:1 !important; }
      .scan-overlay-close {
        position: absolute !important;
        top: 14px !important;
        right: 14px !important;
        width: 46px !important;
        height: 46px !important;
        border: 1px solid rgba(255,255,255,.22) !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.11) !important;
        color: #ffffff !important;
        font-size: 30px !important;
        font-weight: 500 !important;
        line-height: 1 !important;
        display: grid !important;
        place-items: center !important;
        cursor: pointer !important;
        z-index: 5 !important;
        opacity: 1 !important;
        -webkit-tap-highlight-color: transparent;
      }
      .scan-overlay-close:active { transform: scale(.96); }
      .scan-overlay-close[hidden] { display: none !important; }
      @media (max-width: 520px) {
        .scan-overlay { padding: 16px !important; align-items: center !important; }
        .scan-overlay-card { padding: 28px 20px 24px !important; border-radius: 30px !important; }
        .scan-ring { width: 118px !important; height: 118px !important; }
        .scan-ring-icon { width: 50px !important; height: 50px !important; }
        .scan-step { grid-template-columns: 38px 1fr !important; border-radius: 24px !important; padding: 12px !important; }
        .scan-step-num { width: 38px !important; height: 38px !important; }
        .scan-chip { grid-column: 2 !important; width: fit-content !important; }
      }
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