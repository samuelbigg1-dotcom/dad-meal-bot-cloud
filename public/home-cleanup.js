(() => {
  function text(el) { return (el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function isHomePage() {
    const title = text(document.querySelector('h1'));
    return title === 'today' || title === 'home';
  }

  function removeBottomDuplicateCards() {
    if (!isHomePage()) return;

    // The new Home design already has the calorie hero, Next Move, and four action cards.
    // Do not show the old macro-card grid underneath it.
    document.querySelectorAll('.today-compact-macros').forEach((el) => el.remove());

    document.querySelectorAll('.content > .macro-grid').forEach((el) => el.remove());
    document.querySelectorAll('.content > .macro-card').forEach((el) => el.remove());

    document.querySelectorAll('.macro-card').forEach((card) => {
      if (!card.closest('.settings-target-grid') && !card.closest('.settings-plan-grid')) card.remove();
    });

    document.querySelectorAll('section.card').forEach((card) => {
      const heading = text(card.querySelector('h2'));
      if (heading.includes('meals today') || heading === 'weight') card.remove();
    });
  }

  function injectStyles() {
    if (document.getElementById('home-cleanup-style')) return;
    const style = document.createElement('style');
    style.id = 'home-cleanup-style';
    style.textContent = `
      body[data-today-dashboard='true'] .today-compact-macros,
      body[data-today-dashboard='true'] .content > .macro-grid,
      body[data-today-dashboard='true'] .content > .macro-card {
        display: none !important;
      }
      body[data-today-dashboard='true'] .today-dashboard-card {
        padding-bottom: 18px !important;
      }
      body[data-today-dashboard='true'] .content {
        padding-bottom: 132px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function run() {
    injectStyles();
    removeBottomDuplicateCards();
  }

  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 80);
  setTimeout(run, 250);
  setTimeout(run, 700);
  setTimeout(run, 1400);
})();
