(function () {
  const safe = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const r0 = (v) => Math.round(Number(v || 0));
  const r1 = (v) => Math.round(Number(v || 0) * 10) / 10;

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",");
    return lines.map((line) => {
      const cols = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = !quoted;
        else if (ch === "," && !quoted) { cols.push(cur); cur = ""; }
        else cur += ch;
      }
      cols.push(cur);
      return Object.fromEntries(headers.map((h, i) => [h, cols[i] || ""]));
    });
  }

  async function loadDay() {
    const date = new URLSearchParams(location.search).get("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return;
    const card = document.querySelector(".selected-day-card");
    if (!card) return;

    card.innerHTML = `<div class="section-head compact-head"><h2>${safe(date)}</h2><span>Loading</span></div><p class="muted">Loading meals for this day...</p>`;

    const res = await fetch("/export", { credentials: "same-origin" });
    const rows = parseCsv(await res.text()).filter((row) => row.date === date);

    if (!rows.length) {
      card.innerHTML = `<div class="section-head compact-head"><h2>${safe(date)}</h2><span>Day review</span></div><div class="empty">No meals logged for this day.</div><a class="button" href="/history">Back to 7 days</a>`;
      return;
    }

    const totals = rows.reduce((t, row) => {
      t.cal += Number(row.calories || 0);
      t.p += Number(row.protein_g || 0);
      t.c += Number(row.carbs_g || 0);
      t.f += Number(row.fat_g || 0);
      t.s += Number(row.sugar_g || 0);
      t.fi += Number(row.fiber_g || 0);
      return t;
    }, { cal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0 });

    card.innerHTML = `
      <div class="section-head compact-head"><h2>${safe(date)}</h2><a href="/history">Back</a></div>
      <div class="totals-pill"><span>${r0(totals.cal)} cal</span><span>P ${r1(totals.p)}g</span><span>C ${r1(totals.c)}g</span><span>F ${r1(totals.f)}g</span><span>Sug ${r1(totals.s)}g</span><span>Fib ${r1(totals.fi)}g</span></div>
      <div class="list selected-day-meals">
        ${rows.map((row) => `<div class="list-row day-meal-row"><div><strong>${safe(row.meal_type || "meal")}</strong><p>${safe(row.raw_message || "Logged meal")}</p><div class="pill-row mini"><span class="pill">P ${r1(row.protein_g)}g</span><span class="pill">C ${r1(row.carbs_g)}g</span><span class="pill">F ${r1(row.fat_g)}g</span></div></div><div class="cal">${r0(row.calories)} cal</div></div>`).join("")}
      </div>
      <div class="action-row"><a class="button primary" href="/log">Log correction</a><a class="button" href="/history">Back to 7 days</a></div>
      <p class="muted">This reviews the logged meals for the selected day. Direct editing of old meals still needs the next backend route.</p>`;
  }

  document.addEventListener("DOMContentLoaded", loadDay);
})();
