(() => {
  function run() {
    const title = (document.querySelector('h1')?.textContent || '').trim().toLowerCase();
    if (title !== 'today' && title !== 'home') return;

    const reminder = document.querySelector('.weekly-weight-reminder');
    if (!reminder) return;

    const hasWeightLog = document.body.innerText.includes('160.0 lb') || document.body.innerText.toLowerCase().includes('weights');

    if (!hasWeightLog) {
      reminder.remove();
    }
  }

  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 150);
  setTimeout(run, 600);
})();