import "./style.css";

const KEY = "cycle-polished-v2";
const blank = {
    onboarded: false,
    periods: [],
    entries: {},
    settings: {cycleLength: 28, periodLength: 5, theme: "system"}
};
let state = load(), calendar = new Date(), activeTab = "home", chartRange = 6;

function load() {
    try {
        return {...blank, ...JSON.parse(localStorage.getItem(KEY) || "{}")}
    } catch {
        return structuredClone(blank)
    }
}

function save() {
    localStorage.setItem(KEY, JSON.stringify(state))
}

function iso(v) {
    let d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function D(s) {
    return new Date(s + "T12:00:00")
}

function add(s, n) {
    let d = D(s);
    d.setDate(d.getDate() + n);
    return iso(d)
}

function diff(a, b) {
    return Math.round((D(b) - D(a)) / 86400000)
}

function fmt(s, opt = {month: "short", day: "numeric"}) {
    return D(s).toLocaleDateString(undefined, opt)
}

function periods() {
    return [...state.periods].sort()
}

function latest() {
    return periods().at(-1)
}

function avgCycle() {
    let p = periods();
    if (p.length < 2) return state.settings.cycleLength;
    return Math.round(p.slice(1).map((x, i) => diff(p[i], x)).reduce((a, b) => a + b, 0) / (p.length - 1))
}

function avgPeriod() {
    let p = periods();
    if (!p.length) return state.settings.periodLength;
    return Math.round(p.map(x => state.entries[x]?.periodEnd ? diff(x, state.entries[x].periodEnd) + 1 : state.settings.periodLength).reduce((a, b) => a + b, 0) / p.length)
}

function info() {
    let l = latest();
    if (!l) return null;
    let a = avgCycle(), t = iso(new Date());
    return {last: l, day: Math.max(1, diff(l, t) + 1), avg: a, next: add(l, a)}
}

function isPeriod(s) {
    return periods().some(p => s >= p && s <= add(p, state.settings.periodLength - 1))
}

function fertile() {
    let c = info(), set = new Set();
    if (!c) return set;
    let ov = add(c.last, c.avg - 14);
    for (let i = -5; i <= 1; i++) set.add(add(ov, i));
    return set
}

function phase(c) {
    if (!c) return "Ready when you are";
    if (c.day <= state.settings.periodLength) return "Period";
    if (c.day >= c.avg - 16 && c.day <= c.avg - 13) return "Likely fertile";
    return "Cycle day"
}

function daysUntil(s) {
    return Math.max(0, diff(iso(new Date()), s))
}

function esc(s = "") {
    return s.replace(/[&<>"']/g, m => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"}[m]))
}

function app() {
    if (!state.onboarded) return onboarding();
    document.documentElement.dataset.theme = state.settings.theme;
    const c = info();
    document.querySelector("#app").innerHTML = `
  <div class="shell">
    <header class="appbar">
      <div class="brand"><img class="brand-logo" src="/icons/ovella-mark.svg" alt="Ovella" /><div><b>Ovella</b><small>your private rhythm</small></div></div>
      <button class="round" id="quickSettings" aria-label="Settings">⚙</button>
    </header>
    <main>
      ${activeTab === "home" ? home(c) : activeTab === "calendar" ? calendarView() : activeTab === "history" ? historyView() : settingsView()}
    </main>
    <nav class="tabbar">
      <button class="${activeTab === "home" ? "active" : ""}" data-tab="home"><span>⌂</span>Home</button>
      <button class="${activeTab === "calendar" ? "active" : ""}" data-tab="calendar"><span>▦</span>Calendar</button>
      <button class="log-main" id="quickLog">＋</button>
      <button class="${activeTab === "history" ? "active" : ""}" data-tab="history"><span>◔</span>History</button>
      <button class="${activeTab === "settings" ? "active" : ""}" data-tab="settings"><span>⚙</span>Settings</button>
    </nav>
    <div id="modal" class="modal" hidden><div class="sheet"><button class="close" id="close">×</button><div id="modalBody"></div></div></div>
  </div>`;
    bind();
}

function home(c) {
    let today = iso(new Date()), entries = Object.keys(state.entries).sort().reverse().slice(0, 3);
    return `
  <section class="hero">
    <div class="hero-glow"></div>
    <div class="eyebrow">CURRENT CYCLE</div>
    <div class="cycle-number">${c ? c.day : "—"}</div>
    <div class="cycle-label">${c ? "day of your cycle" : "Log your first period"}</div>
    <div class="hero-row"><span class="phase-pill">${phase(c)}</span>${c ? `<span class="hero-next">${daysUntil(c.next)} days until expected period</span>` : ""}</div>
    <div class="ring"><div><b>${c ? Math.round(c.day / c.avg * 100) : 0}%</b><small>through cycle</small></div></div>
  </section>
  <div class="quick-grid">
    <button class="quick-card" id="period"><span class="qi pink">●</span><b>Log period</b><small>Start a new cycle</small></button>
    <button class="quick-card" id="daily"><span class="qi purple">✦</span><b>Daily check-in</b><small>How are you feeling?</small></button>
  </div>
  <section class="section">
    <div class="section-head"><div><span class="eyebrow">AT A GLANCE</span><h2>Your cycle</h2></div></div>
    <div class="metric-grid">
      <div><span>Average</span><b>${avgCycle()}<em> days</em></b></div>
      <div><span>Period</span><b>${avgPeriod()}<em> days</em></b></div>
      <div><span>Next period</span><b>${c ? fmt(c.next) : "—"}</b></div>
    </div>
  </section>
  <section class="section chart-card">
    <div class="section-head"><div><span class="eyebrow">TRENDS</span><h2>Cycle length</h2></div><button class="text-btn" id="historyLink">See all</button></div>
    ${lineChart()}
  </section>
  <section class="section">
    <div class="section-head"><div><span class="eyebrow">RECENT</span><h2>Daily check-ins</h2></div><button class="text-btn" id="calendarLink">Calendar</button></div>
    ${entries.length ? entries.map(k => entryRow(k)).join("") : `<div class="empty"><div class="empty-icon">✦</div><b>No check-ins yet</b><span>Log how you feel each day to build your history.</span></div>`}
  </section>
  <p class="privacy-note">🔒 Your data is stored locally on this device. Nothing is uploaded.</p>`;
}

function lineChart() {
    let p = periods(), rows = [];
    for (let i = Math.max(1, p.length - chartRange); i < p.length; i++) rows.push({
        label: fmt(p[i], {
            month: "short",
            day: "numeric"
        }), value: diff(p[i - 1], p[i])
    });
    if (rows.length < 2) return `<div class="empty chart-empty"><span>Log at least 3 periods to see your cycle trend.</span></div>`;
    let min = Math.min(...rows.map(x => x.value)), max = Math.max(...rows.map(x => x.value)), w = 340, h = 130,
        pad = 12;
    let pts = rows.map((r, i) => {
        let x = pad + i * (w - pad * 2) / (rows.length - 1),
            y = h - pad - (r.value - min) / (Math.max(1, max - min)) * 70;
        return [x, y]
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Cycle length trend"><polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="var(--surface)" stroke="currentColor" stroke-width="3"/><text x="${p[0]}" y="${h - 1}" text-anchor="middle">${rows[i].value}</text>`).join("")}</svg>`;
}

function entryRow(k) {
    let e = state.entries[k];
    return `<button class="entry-row" data-entry="${k}"><span class="date-badge">${D(k).getDate()}</span><span class="entry-main"><b>${fmt(k, {
        weekday: "short",
        month: "short",
        day: "numeric"
    })}</b><small>${(e.symptoms || []).join(" · ") || "No symptoms"}${e.mood ? " · " + e.mood : ""}</small></span><span class="entry-flow">${e.flow || "—"}</span></button>`
}

function calendarView() {
    let p = periods(), f = fertile(), y = calendar.getFullYear(), m = calendar.getMonth(), first = new Date(y, m, 1),
        count = new Date(y, m + 1, 0).getDate(), cells = "";
    for (let i = 0; i < first.getDay(); i++) cells += '<span class="cal-day blank"></span>';
    for (let d = 1; d <= count; d++) {
        let s = iso(new Date(y, m, d)), cl = "cal-day";
        if (isPeriod(s)) cl += " period"; else if (f.has(s)) cl += " fertile";
        if (s === iso(new Date())) cl += " today";
        cells += `<button class="${cl}" data-date="${s}"><span>${d}</span></button>`
    }
    return `<section class="section calendar-section"><div class="calendar-head"><button class="small-round" id="prev">‹</button><div><span class="eyebrow">CALENDAR</span><h2>${calendar.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric"
    })}</h2></div><button class="small-round" id="next">›</button></div>
  <div class="weekdays">${["S", "M", "T", "W", "T", "F", "S"].map(x => `<span>${x}</span>`).join("")}</div><div class="calendar-grid">${cells}</div>
  <div class="legend"><span><i class="dot period-dot"></i>Period</span><span><i class="dot fertile-dot"></i>Estimated fertile window</span><span><i class="dot today-dot"></i>Today</span></div></section>
  <section class="section"><span class="eyebrow">ESTIMATE</span><h2>Coming up</h2><div class="upcoming">${info() ? `<div><span>Expected period</span><b>${fmt(info().next, {
        weekday: "short",
        month: "long",
        day: "numeric"
    })}</b></div><div><span>Estimated fertile window</span><b>${fmt(add(info().last, info().avg - 19), {
        month: "short",
        day: "numeric"
    })} – ${fmt(add(info().last, info().avg - 13), {
        month: "short",
        day: "numeric"
    })}</b></div>` : `<p class="note">Log a period to generate estimates.</p>`}</div></section>`;
}

function historyView() {
    let p = periods().slice().reverse();
    return `<section class="section"><span class="eyebrow">HISTORY</span><h2>Cycle history</h2><p class="sub">Your logged periods and cycle lengths.</p>
  <div class="history-summary"><div><b>${p.length}</b><span>periods logged</span></div><div><b>${avgCycle()}</b><span>average days</span></div><div><b>${avgPeriod()}</b><span>average period</span></div></div>
  <div class="history-list">${p.length ? p.map((x, i) => {
        let prev = p[i + 1], len = prev ? diff(prev, x) : null;
        return `<div class="history-item"><span class="history-date">${fmt(x, {
            month: "short",
            day: "numeric",
            year: "numeric"
        })}</span><span>${len ? `<b>${len} days</b> cycle` : "Latest cycle"}</span><button class="more" data-history="${x}">›</button></div>`
    }).join("") : `<div class="empty"><div class="empty-icon">◔</div><b>Your history will appear here</b><span>Log periods to build a personal record.</span></div>`}</div></section>
  <section class="section chart-card"><span class="eyebrow">INSIGHTS</span><h2>Cycle consistency</h2>${consistency()}</section>`;
}

function consistency() {
    let p = periods();
    if (p.length < 3) return `<p class="note">More logged periods will make this insight meaningful.</p>`;
    let vals = p.slice(1).map((x, i) => diff(p[i], x)), range = Math.max(...vals) - Math.min(...vals);
    return `<div class="insight"><div class="insight-score">${range <= 3 ? "●" : "○"}</div><div><b>${range <= 3 ? "Fairly consistent" : "Some variation"}</b><p>Your logged cycles vary by about ${range} day${range === 1 ? "" : "s"} from shortest to longest.</p></div></div>`
}

function settingsView() {
    return `<section class="section"><span class="eyebrow">SETTINGS</span><h2>Personalize Ovella</h2><div class="settings-list">
<button class="setting" id="themeSetting"><span>Appearance</span><b>${state.settings.theme === "system" ? "System" : state.settings.theme === "dark" ? "Dark" : "Light"} <i>›</i></b></button>
<button class="setting" id="cycleSetting"><span>Typical cycle length</span><b>${state.settings.cycleLength} days <i>›</i></b></button>
<button class="setting" id="periodSetting"><span>Typical period length</span><b>${state.settings.periodLength} days <i>›</i></b></button>
<button class="setting" id="export"><span>Export your data</span><b>JSON <i>›</i></b></button>
<button class="setting danger" id="delete"><span>Delete all data (Warning: This will delete all data!)</span><b>Delete <i>›</i></b></button></div>
<div class="about"><b>About Ovella</b><p>Ovella is designed to keep your personal tracking data on your device. Estimates are informational only and are not medical advice, diagnosis, or contraception.</p></div></section>`
}

function onboarding() {
    document.querySelector("#app").innerHTML = `<div class="onboarding"><div class="onboard-orb"><img src="/icons/ovella-mark.svg" alt="Ovella" /></div><span class="eyebrow">WELCOME TO OVELLA</span><h1>Understand your<br><em>unique rhythm.</em></h1><p>A calm, private way to track your period, symptoms, and cycle patterns.</p><div class="onboard-features"><span>🔒 Private by design</span><span>♡ Simple daily check-ins</span><span>◌ Beautiful cycle insights</span></div><button class="primary big-button" id="start">Get started</button><small>Your data stays on this device.</small></div>`;
    document.querySelector("#start").onclick = () => {
        state.onboarded = true;
        save();
        app()
    };
}

function modal(kind, date = iso(new Date())) {
    const modal = document.querySelector("#modal"), body = document.querySelector("#modalBody");
    modal.hidden = false;
    if (kind === "period") body.innerHTML = `<form class="form"><span class="eyebrow">PERIOD</span><h2>Log your period</h2><p class="sub">When did your latest period begin?</p><label>Start date<input id="pdate" type="date" value="${latest() || date}" required></label><label>Typical period length<input id="plen" type="number" min="1" max="14" value="${state.settings.periodLength}"></label><button class="primary">Save period</button></form>`;
    if (kind === "daily") {
        let e = state.entries[date] || {symptoms: []},
            sym = ["Cramps", "Headache", "Bloating", "Tender breasts", "Fatigue", "Spotting", "Backache", "Acne"];
        body.innerHTML = `<form class="form"><span class="eyebrow">DAILY CHECK-IN</span><h2>${fmt(date, {
            weekday: "long",
            month: "long",
            day: "numeric"
        })}</h2><label>Flow<select id="flow"><option>None</option><option>Spotting</option><option>Light</option><option>Medium</option><option>Heavy</option></select></label><label>Mood<select id="mood"><option>Not logged</option><option>Great</option><option>Good</option><option>Okay</option><option>Low</option><option>Irritable</option></select></label><label>Symptoms<div class="chips">${sym.map(x => `<button type="button" class="chip ${e.symptoms?.includes(x) ? "selected" : ""}" data-sym="${x}">${x}</button>`).join("")}</div></label><label>Notes<textarea id="notes" placeholder="Anything you want to remember?">${esc(e.notes)}</textarea></label><div class="row"><button type="button" class="secondary" id="mark">Mark as period</button><button class="primary">Save check-in</button></div></form>`;
        body.querySelector("#flow").value = e.flow || "None";
        body.querySelector("#mood").value = e.mood || "Not logged";
        body.querySelectorAll(".chip").forEach(b => b.onclick = () => b.classList.toggle("selected"));
        body.querySelector("#mark").onclick = () => {
            if (!state.periods.includes(date)) state.periods.push(date);
            save();
            app()
        };
        body.querySelector("form").onsubmit = e2 => {
            e2.preventDefault();
            state.entries[date] = {
                flow: body.querySelector("#flow").value,
                mood: body.querySelector("#mood").value,
                notes: body.querySelector("#notes").value,
                symptoms: [...body.querySelectorAll(".chip.selected")].map(x => x.dataset.sym)
            };
            save();
            app()
        };
        return
    }
    if (kind === "theme") body.innerHTML = `<div class="form"><span class="eyebrow">APPEARANCE</span><h2>Choose a theme</h2>${["system", "light", "dark"].map(x => `<button class="setting ${state.settings.theme === x ? "selected" : ""}" data-theme="${x}"><span>${x[0].toUpperCase() + x.slice(1)}</span><b>${state.settings.theme === x ? "✓" : "›"}</b></button>`).join("")}</div>`;
    if (kind === "number") {
        body.innerHTML = `<form class="form"><span class="eyebrow">${date === "cycle" ? "CYCLE" : "PERIOD"}</span><h2>Update ${date === "cycle" ? "cycle" : "period"} length</h2><input id="num" type="number" min="${date === "cycle" ? 15 : 1}" max="${date === "cycle" ? 90 : 14}" value="${date === "cycle" ? state.settings.cycleLength : state.settings.periodLength}"><button class="primary">Save</button></form>`;
        body.querySelector("form").onsubmit = e => {
            e.preventDefault();
            let n = +body.querySelector("#num").value;
            if (date === "cycle") state.settings.cycleLength = n; else state.settings.periodLength = n;
            save();
            app()
        }
    }
    if (kind === "period") {
        body.querySelector("form").onsubmit = e => {
            e.preventDefault();
            let p = body.querySelector("#pdate").value;
            state.settings.periodLength = +body.querySelector("#plen").value || 5;
            if (!state.periods.includes(p)) state.periods.push(p);
            save();
            app()
        }
    }
    body.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => {
        state.settings.theme = b.dataset.theme;
        save();
        app()
    });
}

function bind() {
    document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
        activeTab = b.dataset.tab;
        app()
    });
    document.querySelector("#quickLog")?.addEventListener("click", () => modal("daily"));
    document.querySelector("#quickSettings")?.addEventListener("click", () => {
        activeTab = "settings";
        app()
    });
    document.querySelector("#period")?.addEventListener("click", () => modal("period"));
    document.querySelector("#daily")?.addEventListener("click", () => modal("daily"));
    document.querySelector("#historyLink")?.addEventListener("click", () => {
        activeTab = "history";
        app()
    });
    document.querySelector("#calendarLink")?.addEventListener("click", () => {
        activeTab = "calendar";
        app()
    });
    document.querySelector("#prev")?.addEventListener("click", () => {
        calendar.setMonth(calendar.getMonth() - 1);
        app()
    });
    document.querySelector("#next")?.addEventListener("click", () => {
        calendar.setMonth(calendar.getMonth() + 1);
        app()
    });
    document.querySelectorAll("[data-date]").forEach(b => b.onclick = () => modal("daily", b.dataset.date));
    document.querySelectorAll("[data-entry]").forEach(b => b.onclick = () => modal("daily", b.dataset.entry));
    document.querySelectorAll("[data-history]").forEach(b => b.onclick = () => modal("daily", b.dataset.history));
    document.querySelector("#themeSetting")?.addEventListener("click", () => modal("theme"));
    document.querySelector("#cycleSetting")?.addEventListener("click", () => modal("number", "cycle"));
    document.querySelector("#periodSetting")?.addEventListener("click", () => modal("number", "period"));
    document.querySelector("#export")?.addEventListener("click", () => {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: "application/json"}));
        a.download = "cycle-data.json";
        a.click()
    });
    document.querySelector("#delete")?.addEventListener("click", () => {
        if (confirm("Delete all data from this device?")) {
            state = structuredClone(blank);
            save();
            app()
        }
    });
    document.querySelector("#close")?.addEventListener("click", () => app());
}

app();
