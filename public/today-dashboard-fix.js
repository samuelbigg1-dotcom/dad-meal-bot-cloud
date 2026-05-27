(() => {
  const svg = {
    Foods: '<svg viewBox="0 0 24 24"><path d="M7 3v18M4.5 3v7.5a2.5 2.5 0 0 0 5 0V3M16 3v18M16 3c2.4 1.6 3.4 3.8 3.4 6.3 0 2-1 3.7-3.4 4.6"/></svg>',
    Log: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    Home: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
    Today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
    Meals: '<svg viewBox="0 0 24 24"><path d="M5 11h14M7 11v2.5a5 5 0 0 0 10 0V11M9 7c-.7-.7-.7-1.6 0-2.3M12 7c-.7-.7-.7-1.6 0-2.3M15 7c-.7-.7-.7-1.6 0-2.3M8 19h8"/></svg>',
    Progress: '<svg viewBox="0 0 24 24"><path d="M5 19V9M12 19V5M19 19v-7M4 19h16"/></svg>',
    Scan: '<svg viewBox="0 0 24 24"><path d="M8 5v14M11 5v14M14 5v14M17 5v14M5 7v10M20 7v10"/></svg>',
    Search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="4.8"/><path d="m15 15 4 4"/></svg>',
    Arrow: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>'
  };
  const clean = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  function patchIcons() {
    document.querySelectorAll('.bottom-nav a').forEach((a) => {
      let label = a.dataset.navLabel || clean(a).replace(/[☼♨⚑▥+]/g, '').trim();
      if (label === 'Today') label = 'Home';
      if (!label) return;
      a.dataset.navLabel = label;
      a.innerHTML = `<span class="nav-icon">${svg[label] || ''}</span><span class="nav-label">${label}</span>`;
    });
    document.querySelectorAll('.today-action').forEach((a) => {
      const label = clean(a.querySelector('strong'));
      const icon = label === 'Scan food' ? svg.Scan : label === 'Log meal' ? svg.Log : label === 'Foods' ? svg.Search : svg.Arrow;
      const span = a.querySelector('span');
      if (span) span.innerHTML = icon;
    });
  }

  function removeExtras() {
    const h1 = clean(document.querySelector('h1')).toLowerCase();
    const isHome = h1 === 'today' || h1 === 'home';
    const dashboard = document.querySelector('.today-dashboard-card');
    if (isHome) {
      document.querySelectorAll('section.card').forEach((card) => {
        const h = clean(card.querySelector('h2')).toLowerCase();
        if (h.includes('meals today') || h === 'weight') card.remove();
      });
      if (dashboard) {
        document.querySelectorAll('.content > .macro-grid, .content > section.hero.card').forEach((el) => el.remove());
        document.querySelectorAll('.macro-grid').forEach((grid) => {
          if (!grid.closest('.today-dashboard-card')) grid.remove();
        });
        document.querySelectorAll('.macro-card').forEach((card) => {
          if (!card.closest('.today-dashboard-card')) card.remove();
        });
      }
    }
  }

  function style() {
    if (document.getElementById('today-dashboard-fix-style')) return;
    const s = document.createElement('style');
    s.id = 'today-dashboard-fix-style';
    s.textContent = `
      body[data-today-dashboard="true"] .content{max-width:760px;margin:0 auto;padding:0 14px 108px!important}.today-dashboard-card{padding:18px!important;gap:14px!important;border-radius:30px!important}.today-hero-block h2{font-size:clamp(38px,8.4vw,58px)!important;margin:7px 0 16px!important}.today-progress{height:14px!important}.today-hero-block p{font-size:16px!important;margin-top:12px!important}.today-next-card{padding:14px!important;border-radius:24px!important}.today-next-card .section-head h2{font-size:23px!important}.today-next-card .section-head span{font-size:16px!important}.today-next-card p{font-size:16px!important;line-height:1.36!important;margin-bottom:12px!important}.today-next-bottom .button{min-height:52px!important;min-width:162px!important;border-radius:14px!important}.today-food-plate{font-size:36px!important}.today-action-grid{gap:12px!important}.today-action{min-height:76px!important;padding:12px 14px!important;border-radius:18px!important;font-size:17px!important;gap:13px!important}.today-action span{width:46px!important;height:46px!important;flex:0 0 46px!important}.today-action svg,.bottom-nav svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}.today-action svg{width:25px;height:25px;stroke-width:1.9}.today-compact-macros .macro-card{min-height:102px!important;padding:13px!important;border-radius:18px!important}.today-compact-macros .macro-head span{font-size:16px!important;margin-bottom:6px!important}.today-compact-macros .macro-head strong{font-size:22px!important}.today-compact-macros .macro-values{font-size:14px!important;margin-top:8px!important}.bottom-nav{left:50%!important;transform:translateX(-50%)!important;width:min(760px,calc(100vw - 20px))!important;bottom:max(2px,env(safe-area-inset-bottom))!important;border-radius:28px!important;padding:8px 10px!important;align-items:center!important}.bottom-nav a{min-height:56px!important;border-radius:22px!important;font-size:12px!important;padding:8px 4px!important;gap:5px!important}.bottom-nav a .nav-icon svg{width:27px;height:27px;stroke-width:1.85}.bottom-nav a.active{transform:translateY(-15px)!important;min-width:104px!important;min-height:74px!important;border-radius:30px!important;border:6px solid var(--bg)!important}.bottom-nav a.active .nav-icon svg{width:34px;height:34px;stroke-width:1.65}.bottom-nav a.active .nav-label{font-size:15px!important}
      @media(max-width:390px){.today-action{font-size:16px!important}.today-next-card p{font-size:15px!important}.today-food-plate{display:none!important}.bottom-nav{width:calc(100vw - 16px)!important}}
    `;
    document.head.appendChild(s);
  }

  function run(){ style(); patchIcons(); removeExtras(); }
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 80); setTimeout(run, 250); setTimeout(run, 600); setTimeout(run, 1200);
})();
