(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const num = (value) => Number(String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] || 0);
  const pageTitle = () => text(document.querySelector('h1')).toLowerCase();
  const isProgress = () => pageTitle() === 'history' || pageTitle() === 'progress';
  const isHome = () => pageTitle() === 'today' || pageTitle() === 'home';

  function parseDays() {
    return [...document.querySelectorAll('.history-day-link')].map((row) => {
      const date = text(row.querySelector('strong'));
      const copy = text(row.querySelector('p'));
      return {
        date,
        calories: num(row.querySelector('.cal')),
        protein: num(copy.match(/P\s*([\d.]+)/i)?.[1]),
        carbs: num(copy.match(/C\s*([\d.]+)/i)?.[1]),
        fat: num(copy.match(/F\s*([\d.]+)/i)?.[1]),
        href: row.getAttribute('href') || `/history?date=${date}`
      };
    }).filter((d) => d.date);
  }

  function parseWeights() {
    const card = [...document.querySelectorAll('section.card')].find((c) => text(c.querySelector('h2')).toLowerCase() === 'weights');
    if (!card) return [];
    return [...card.querySelectorAll('.list-row')].map((row) => {
      const parts = [...row.children].map(text);
      return { date: parts[0] || '', weight: num(parts[1] || row) };
    }).filter((w) => w.date && w.weight).sort((a, b) => b.date.localeCompare(a.date));
  }

  function daysSince(dateString) {
    if (!dateString) return Infinity;
    const then = new Date(`${dateString}T12:00:00`);
    const now = new Date();
    return Math.floor((now - then) / 86400000);
  }

  function streak(days) {
    let count = 0;
    for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
      if (day.calories > 0) count += 1;
      else break;
    }
    return count;
  }

  function insight(days, weights) {
    if (weights.length >= 2) {
      const diff = Math.round((weights[0].weight - weights[weights.length - 1].weight) * 10) / 10;
      if (diff < 0) return `Weight trend is down ${Math.abs(diff).toFixed(1)} lb across recent check-ins.`;
      if (diff > 0) return `Weight trend is up ${diff.toFixed(1)} lb across recent check-ins.`;
    }
    const best = [...days].sort((a, b) => b.protein - a.protein)[0];
    if (best?.protein) return `${best.date.slice(5)} was the strongest protein day at ${Math.round(best.protein)}g.`;
    return 'Log a few more days and this becomes real trend coaching.';
  }

  function miniBars(days) {
    const last = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
    const max = Math.max(1, ...last.map((d) => d.calories));
    return `<div class="progress-mini-bars">${last.map((d) => `<a href="${d.href}" class="progress-mini-bar" style="--h:${Math.max(12, Math.round((d.calories / max) * 100))}%"><i></i><span>${d.date.slice(5)}</span></a>`).join('')}</div>`;
  }

  function weightSpark(weights) {
    const recent = [...weights].reverse().slice(-7);
    if (recent.length < 2) return '<div class="progress-empty-line">Add one more weigh-in for a trend line.</div>';
    const vals = recent.map((w) => w.weight);
    const min = Math.min(...vals), max = Math.max(...vals), range = Math.max(1, max - min);
    return `<div class="progress-weight-spark">${recent.map((w) => `<span style="--y:${92 - Math.round(((w.weight - min) / range) * 70)}%"><b>${w.weight.toFixed(1)}</b></span>`).join('')}</div>`;
  }

  function weightReminder(weights) {
    const latest = weights[0];
    const age = daysSince(latest?.date);
    if (age < 7) return '';
    const key = `weightReminderDismissed:${latest?.date || 'never'}`;
    if (localStorage.getItem(key) === 'true') return '';
    return `<section class="card weekly-weight-reminder" data-weight-reminder-key="${key}"><div><strong>Weekly weigh-in due</strong><p>${latest ? `Last logged ${age} days ago.` : 'No weight logged yet.'} Keep the trend accurate with one quick entry.</p></div><a class="button primary" href="/history#weight-log">Log weight</a><button type="button" class="weight-reminder-dismiss" aria-label="Dismiss">×</button></section>`;
  }

  function renderProgress() {
    if (!isProgress() || document.body.dataset.progressPolished === 'true') return;
    const content = document.querySelector('.content');
    if (!content) return;
    const days = parseDays();
    const weights = parseWeights();
    if (!days.length && !weights.length) return;
    document.body.dataset.progressPolished = 'true';

    const avgCal = days.length ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0;
    const avgProtein = days.length ? Math.round(days.reduce((s, d) => s + d.protein, 0) / days.length) : 0;
    const proteinHits = days.filter((d) => d.protein >= 120).length;
    const logged = streak(days);
    const wDelta = weights.length >= 2 ? Math.round((weights[0].weight - weights[weights.length - 1].weight) * 10) / 10 : null;

    const dashboard = document.createElement('section');
    dashboard.className = 'card progress-glance-card';
    dashboard.innerHTML = `
      <div class="progress-glance-head"><div><h2>Weekly glance</h2><p>Clean trends, not spreadsheet punishment.</p></div><span>${days.length || 0} days</span></div>
      <div class="progress-pill-row">
        <div><small>Calories</small><strong>${avgCal || '—'}</strong><em>avg/day</em></div>
        <div><small>Protein</small><strong>${avgProtein || '—'}g</strong><em>${proteinHits}/${days.length || 0} hit</em></div>
        <div><small>Streak</small><strong>${logged}</strong><em>days</em></div>
        <div><small>Weight</small><strong>${wDelta === null ? '—' : `${wDelta > 0 ? '+' : ''}${wDelta.toFixed(1)}`}</strong><em>lb</em></div>
      </div>
      <div class="progress-two-up">
        <div class="progress-soft-panel"><div class="mini-head"><strong>Calories</strong><span>7 days</span></div>${days.length ? miniBars(days) : '<div class="progress-empty-line">No calories yet.</div>'}</div>
        <div class="progress-soft-panel"><div class="mini-head"><strong>Weight</strong><span>trend</span></div>${weightSpark(weights)}</div>
      </div>
      <div class="progress-insight-slim"><span>Insight</span><p>${insight(days, weights)}</p></div>`;

    const hero = content.querySelector('section.hero.card, .card.hero');
    if (hero) {
      hero.replaceWith(dashboard);
    } else {
      content.prepend(dashboard);
    }

    const oldDaily = [...document.querySelectorAll('section.card')].find((c) => text(c.querySelector('h2')).toLowerCase() === 'daily totals');
    if (oldDaily) oldDaily.classList.add('progress-list-card');
    const weightCard = [...document.querySelectorAll('section.card')].find((c) => text(c.querySelector('h2')).toLowerCase() === 'weights');
    if (weightCard) {
      weightCard.id = 'weight-log';
      weightCard.classList.add('progress-list-card');
      const reminder = weightReminder(weights);
      if (reminder) weightCard.insertAdjacentHTML('beforebegin', reminder);
    }

    document.querySelectorAll('.history-day-link').forEach((link) => {
      const p = link.querySelector('p');
      if (p && !link.querySelector('.progress-mini-note')) p.insertAdjacentHTML('afterend', '<small class="progress-mini-note">Tap for meals</small>');
    });
  }

  function renderHomeReminder() {
    if (!isHome() || document.querySelector('.weekly-weight-reminder')) return;
    const weights = parseWeights();
    const html = weightReminder(weights);
    if (!html) return;
    const content = document.querySelector('.content');
    const after = document.querySelector('.today-dashboard-card') || content?.firstElementChild;
    if (after) after.insertAdjacentHTML('afterend', html);
  }

  function bindDismiss() {
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('.weight-reminder-dismiss');
      if (!btn) return;
      const card = btn.closest('.weekly-weight-reminder');
      const key = card?.dataset.weightReminderKey;
      if (key) localStorage.setItem(key, 'true');
      card?.remove();
    });
  }

  function styles() {
    if (document.getElementById('progress-polish-style')) return;
    const s = document.createElement('style');
    s.id = 'progress-polish-style';
    s.textContent = `
      .bottom-nav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important;box-sizing:border-box!important}.bottom-nav a{width:100%!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;line-height:1!important}.bottom-nav a .nav-icon{display:grid!important;place-items:center!important;margin:0 auto!important}.bottom-nav a .nav-label{display:block!important;width:100%!important;text-align:center!important}.bottom-nav a.active{min-width:0!important;width:100%!important;transform:translateY(-10px)!important}.bottom-nav a:nth-child(2){transform:none!important}.bottom-nav a:nth-child(2).active{transform:translateY(-10px)!important}
      .progress-glance-card{padding:18px!important;display:grid;gap:14px!important}.progress-glance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.progress-glance-head h2{margin:0;font-size:28px;letter-spacing:-.05em}.progress-glance-head p{margin:5px 0 0;color:var(--muted);font-size:15px;line-height:1.25}.progress-glance-head span{color:var(--accent);font-weight:950;background:rgba(216,123,85,.11);border:1px solid rgba(216,123,85,.2);border-radius:999px;padding:7px 10px;white-space:nowrap}
      .progress-pill-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.progress-pill-row div{border:1px solid var(--line);border-radius:16px;padding:10px;background:rgba(255,255,255,.03);min-width:0}.progress-pill-row small,.mini-head span{display:block;color:var(--muted);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.progress-pill-row strong{display:block;margin-top:5px;font-size:22px;line-height:1;letter-spacing:-.04em;white-space:nowrap}.progress-pill-row em{display:block;margin-top:4px;color:var(--accent);font-style:normal;font-size:12px;font-weight:850;white-space:nowrap}
      .progress-two-up{display:grid;grid-template-columns:1fr 1fr;gap:10px}.progress-soft-panel{border:1px solid var(--line);border-radius:18px;padding:12px;background:rgba(255,255,255,.025);min-width:0}.mini-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.mini-head strong{font-size:16px}.progress-mini-bars{height:78px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;align-items:end}.progress-mini-bar{height:100%;display:grid;grid-template-rows:1fr auto;gap:5px;text-align:center;text-decoration:none;color:var(--muted);font-size:10px;font-weight:850}.progress-mini-bar i{align-self:end;height:var(--h);border-radius:999px;background:linear-gradient(180deg,var(--accent),#cf6848);opacity:.9}.progress-weight-spark{height:78px;position:relative;border-radius:14px;background:rgba(0,0,0,.09);display:flex;justify-content:space-around}.progress-weight-spark span{position:relative;flex:1}.progress-weight-spark span:after{content:'';position:absolute;left:50%;top:var(--y);width:10px;height:10px;border-radius:999px;background:var(--accent);box-shadow:0 0 0 6px rgba(216,123,85,.12);transform:translate(-50%,-50%)}.progress-weight-spark b{position:absolute;left:50%;top:calc(var(--y) + 12px);transform:translateX(-50%);font-size:10px;color:var(--muted);font-weight:850}.progress-empty-line{min-height:78px;display:grid;place-items:center;text-align:center;color:var(--muted);font-size:13px;line-height:1.25}
      .progress-insight-slim{display:flex;align-items:flex-start;gap:10px;border:1px solid rgba(216,123,85,.18);background:rgba(216,123,85,.07);border-radius:18px;padding:12px}.progress-insight-slim span{color:var(--accent);font-weight:950;white-space:nowrap}.progress-insight-slim p{margin:0;color:var(--muted);line-height:1.3;font-size:14px}.progress-list-card{padding:18px!important}.progress-list-card h2{font-size:24px!important}.progress-mini-note{display:block;color:var(--accent);font-weight:850;margin-top:5px;font-size:13px}.weekly-weight-reminder{display:flex!important;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px!important;border-color:rgba(216,123,85,.3)!important;background:linear-gradient(135deg,rgba(216,123,85,.13),rgba(255,255,255,.025))!important}.weekly-weight-reminder strong{font-size:17px}.weekly-weight-reminder p{margin:4px 0 0;color:var(--muted);font-size:13px;line-height:1.25}.weekly-weight-reminder .button{min-height:42px!important;padding:0 14px!important;white-space:nowrap}.weight-reminder-dismiss{width:34px;height:34px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--muted);font-size:22px;line-height:1}
      @media(max-width:430px){.progress-pill-row{grid-template-columns:repeat(2,minmax(0,1fr))}.progress-two-up{grid-template-columns:1fr}.progress-glance-head h2{font-size:26px}.weekly-weight-reminder{align-items:flex-start}.weekly-weight-reminder .button{font-size:13px}}
    `;
    document.head.appendChild(s);
  }

  function run(){ styles(); renderProgress(); renderHomeReminder(); }
  bindDismiss();
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 100); setTimeout(run, 500); setTimeout(run, 1200);
})();