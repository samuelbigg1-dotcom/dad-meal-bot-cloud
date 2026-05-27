(() => {
  function run() {
    if (document.getElementById('nav-restore-style')) return;
    const style = document.createElement('style');
    style.id = 'nav-restore-style';
    style.textContent = `
      .bottom-nav{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;box-sizing:border-box!important}
      .bottom-nav a{flex:1 1 0!important;width:auto!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;line-height:1!important}
      .bottom-nav a .nav-icon{display:grid!important;place-items:center!important;margin:0 auto!important}
      .bottom-nav a .nav-label{display:block!important;width:auto!important;text-align:center!important}
      .bottom-nav a.active{flex:0 0 auto!important;width:auto!important;min-width:132px!important;transform:translateY(-15px)!important}
      @media(max-width:390px){.bottom-nav{gap:6px!important}.bottom-nav a.active{min-width:118px!important}}
    `;
    document.head.appendChild(style);
  }
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 100);
  setTimeout(run, 500);
})();