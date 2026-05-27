(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const num = (value) => Number(String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] || 0);
  const title = () => text(document.querySelector('h1')).toLowerCase();

  function isProgress() {
    return title() === 'history' || title() === 'progress';
  }

  function parseDays() {
    return [...document.querySelectorAll('.history-day-link')].map((row) => {
      const date = text(row.querySelector('strong'));
      const copy = text(row.querySelector('p'));
      const cal = num(row.querySelector('.cal'));
      return {
        date,
        calories: cal,
        protein: num(copy.match(/P\s*([\d.]+)/i)?.[1]),
        carbs: num(copy.match(/C\s*([\d.]+)/i)?.[1]),
        fat: num(copy.match(/F\s*([\d.]+)/i)?.[1]),
        href: row.getAttribute('href') || `/history?date=${date}`
      };
    }).filter((d) => d.date);
  }

  function parseWeights() {
    const weightCard = [...document.querySelectorAll('section.card')].find((card) => text(card.querySelector('h2')).toLowerCase() === 'weights');
    if (!weightCard) return [];
    return [...weightCard.querySelectorAll('.list-row')].map((row) => {
      const parts = [...row.children].map(text);
      return { date: parts[0] || '', weight: num(parts[1] || row) };
    }).filter((w) => w.date && w.weight);
  }

  function streak(days) {
    if (!days.length) return 0;
    let count = 0;
    for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
      if (day.calories > 0) count += 1;
      else break;
    }
    return count;
  }

  function insight(days, weights) {
    if (weights.length >= 2) {
      const latest = weights[0].weight;
      const oldest = weights[weights.length - 1].weight;
      const diff = Math.round((latest - oldest) * 10) / 10;
      if (diff < 0) return `Weight is down ${Math.abs(diff).toFixed(1)} lb across recent check-ins.`;
      if (diff > 0) return `Weight is up ${diff.toFixed(1)} lb across recent check-ins.`;
    }
    const bestProtein = [...days].sort((a, b) => b.protein - a.protein)[0];
    if (bestProtein?.protein) return `${bestProtein.date} was the strongest protein day at ${Math.round(bestProtein.protein)}g.`;
    return 'Log a few more days and this will turn into real trend coaching.';
  }

  function buildChart(days) {
    const max = Math.max(1, ...days.map((d) => d.calories));
    return `<div class="progress-chart">${days.map((d) => `<a href="${d.href}" class="progress-bar" style="--h:${Math.max(8, Math.round((d.calories / max) * 100))}%"><span>${Math.round(d.calories)}</span><i></i><small>${d.date.slice(5)}</small></a>`).join('')}</div>`;
  }

  function buildWeightTrend(weights) {
    if (weights.length < 2) return '<p class="muted">Add a couple more weigh-ins to unlock the trend line.</p>';
    const recent = [...weights].reverse().slice(-7);
    const vals = recent.map((w) => w.weight);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = Math.max(1, max - min);
    return `<div class="weight-trend">${recent.map((w) => `<div class="weight-dot" style="--y:${100 - Math.round(((w.weight - min) / range) * 82)}%"><span>${w.weight.toFixed(1)}</span></div>`).join('')}</div>`;
  }

  function render() {
    if (!isProgress() || document.body.dataset.progressPolished === 'true') return;
    const content = document.querySelector('.content');
    if (!content) return;
    const days = parseDays();
    const weights = parseWeights();
    if (!days.length && !weights.length) return;

    document.body.dataset.progressPolished = 'true';
    const calorieAvg = days.length ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0;
    const proteinHits = days.filter((d) => d.protein >= 120).length;
    const logStreak = streak(days);
    const bestDay = [...days].sort((a, b) => b.protein - a.protein)[0];
    const latestWeight = weights[0]?.weight;
    const oldestWeight = weights[weights.length - 1]?.weight;
    const weightDelta = latestWeight && oldestWeight ? Math.round((latestWeight - oldestWeight) * 10) / 10 : 0;

    const dashboard = document.createElement('section');
    dashboard.className = 'card progress-command-card';
    dashboard.innerHTML = `
      <div class="section-head"><h2>Progress command center</h2><span>${days.length || 0} days</span></div>
      <p class="muted">Trends, streaks, and the quick answer to whether the plan is working.</p>
      <div class="progress-stat-grid">
        <div class="progress-stat"><small>Calorie average</small><strong>${calorieAvg || '—'}</strong><span>cal/day</span></div>
        <div class="progress-stat"><small>Protein hits</small><strong>${proteinHits}/${days.length || 0}</strong><span>days over 120g</span></div>
        <div class="progress-stat"><small>Logging streak</small><strong>${logStreak}</strong><span>days</span></div>
        <div class="progress-stat"><small>Weight trend</small><strong>${weightDelta ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)}` : '—'}</strong><span>lb</span></div>
      </div>
      <div class="progress-insight"><strong>Smart insight</strong><p>${insight(days, weights)}</p></div>
      ${days.length ? `<h3>Calories by day</h3>${buildChart(days)}` : ''}
      <h3>Weight trend</h3>${buildWeightTrend(weights)}
      ${bestDay ? `<a class="button primary wide" href="${bestDay.href}">Review best protein day</a>` : ''}`;

    const hero = content.querySelector('section.hero.card, .card.hero');
    (hero || content.firstElementChild)?.insertAdjacentElement('afterend', dashboard) || content.prepend(dashboard);

    document.querySelectorAll('.history-day-link').forEach((link) => {
      const p = link.querySelector('p');
      if (p && !link.querySelector('.progress-mini-note')) p.insertAdjacentHTML('afterend', '<small class="progress-mini-note">Tap to expand meals and macros</small>');
    });
  }

  function styles() {
    if (document.getElementById('progress-polish-style')) return;
    const s = document.createElement('style');
    s.id = 'progress-polish-style';
    s.textContent = `
      .bottom-nav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important;box-sizing:border-box!important;}
      .bottom-nav a{width:100%!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;line-height:1!important;}
      .bottom-nav a .nav-icon{display:grid!important;place-items:center!important;margin:0 auto!important;}
      .bottom-nav a .nav-label{display:block!important;width:100%!important;text-align:center!important;}
      .bottom-nav a.active{min-width:0!important;width:100%!important;transform:translateY(-10px)!important;}
      .bottom-nav a:nth-child(2){transform:none!important;}
      .bottom-nav a:nth-child(2).active{transform:translateY(-10px)!important;}
      .progress-command-card{display:grid;gap:16px;}
      .progress-command-card h3{margin:4px 0 0;font-size:18px;}
      .progress-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
      .progress-stat{border:1px solid var(--line);border-radius:20px;padding:14px;background:rgba(255,255,255,.035);}
      .progress-stat small{display:block;color:var(--muted);font-weight:850;margin-bottom:7px;}
      .progress-stat strong{display:block;font-size:30px;letter-spacing:-.05em;line-height:1;color:var(--text);}
      .progress-stat span{display:block;color:var(--accent);font-weight:900;margin-top:5px;}
      .progress-insight{border:1px solid rgba(216,123,85,.25);border-radius:22px;padding:16px;background:rgba(216,123,85,.09);}
      .progress-insight strong{color:var(--accent);font-size:18px;}.progress-insight p{margin:6px 0 0;line-height:1.35;}
      .progress-chart{height:150px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:end;gap:8px;padding:12px 4px 0;}
      .progress-bar{height:100%;display:grid;grid-template-rows:auto 1fr auto;gap:6px;text-decoration:none;color:var(--muted);font-weight:850;text-align:center;min-width:0;}
      .progress-bar span{font-size:11px;white-space:nowrap;}.progress-bar i{align-self:end;height:var(--h);border-radius:999px 999px 8px 8px;background:linear-gradient(180deg,var(--accent),#cf6848);box-shadow:0 10px 24px rgba(199,92,62,.22);}.progress-bar small{font-size:11px;}
      .weight-trend{height:96px;border:1px solid var(--line);border-radius:20px;position:relative;display:flex;justify-content:space-around;align-items:stretch;padding:10px 8px;background:rgba(255,255,255,.025);}
      .weight-dot{position:relative;flex:1;}.weight-dot:after{content:'';position:absolute;left:50%;top:var(--y);width:12px;height:12px;border-radius:999px;background:var(--accent);box-shadow:0 0 0 7px rgba(216,123,85,.12);transform:translate(-50%,-50%);}.weight-dot span{position:absolute;left:50%;top:calc(var(--y) + 13px);transform:translateX(-50%);font-size:11px;color:var(--muted);white-space:nowrap;}
      .progress-mini-note{display:block;color:var(--accent);font-weight:850;margin-top:5px;}
      @media(max-width:390px){.bottom-nav{gap:4px!important}.bottom-nav a .nav-label{font-size:11px!important}.progress-stat strong{font-size:26px}.progress-stat-grid{gap:10px}}
    `;
    document.head.appendChild(s);
  }

  function run(){ styles(); render(); }
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 100);
  setTimeout(run, 500);
})();