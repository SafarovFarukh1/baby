'use strict';
(function () {
/* ================= данные и нормы ================= */
const NORMS = [
  { from: 0,  to: 1,  label: '0–1 мес',    wake: [45, 60],   feeds: [8, 12], sleep: [14, 17], naps: '4–6, без режима', ml: [30, 90] },
  { from: 1,  to: 2,  label: '1–2 мес',    wake: [60, 90],   feeds: [7, 10], sleep: [14, 17], naps: '4–5', ml: [90, 120] },
  { from: 2,  to: 3,  label: '2–3 мес',    wake: [75, 105],  feeds: [6, 9],  sleep: [14, 17], naps: '4–5', ml: [120, 150] },
  { from: 3,  to: 4,  label: '3–4 мес',    wake: [75, 120],  feeds: [6, 8],  sleep: [14, 17], naps: '3–4', ml: [120, 180] },
  { from: 4,  to: 6,  label: '4–6 мес',    wake: [105, 150], feeds: [5, 7],  sleep: [12, 16], naps: '3',   ml: [150, 210] },
  { from: 6,  to: 9,  label: '6–9 мес',    wake: [150, 210], feeds: [4, 6],  sleep: [12, 16], naps: '2–3', ml: [180, 240], solids: true },
  { from: 9,  to: 12, label: '9–12 мес',   wake: [180, 240], feeds: [3, 5],  sleep: [12, 16], naps: '2',   ml: [180, 240], solids: true },
  { from: 12, to: 18, label: '1–1,5 года', wake: [240, 330], feeds: [3, 4],  sleep: [11, 14], naps: '1–2', ml: null, solids: true },
  { from: 18, to: 36, label: '1,5–3 года', wake: [300, 360], feeds: [2, 3],  sleep: [11, 14], naps: '1',   ml: null, solids: true }
];
const KEY = 'malysh-v1';
const H = 36e5, DAY = 864e5;

const pad = n => String(n).padStart(2, '0');
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dur = ms => { ms = Math.max(0, ms); const m = Math.round(ms / 6e4), h = Math.floor(m / 60); return h ? h + ' ч ' + pad(m % 60) + ' мин' : m + ' мин'; };
const durS = ms => { ms = Math.max(0, ms); const m = Math.round(ms / 6e4), h = Math.floor(m / 60); return h ? h + 'ч ' + pad(m % 60) + 'м' : m + 'м'; };
const clock = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60); };
const clockHM = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 6e4), h = Math.floor(m / 60); return h ? h + 'ч ' + pad(m % 60) + 'м' : m + ' мин'; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toInput = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fromInput = v => { const t = new Date(v).getTime(); return isNaN(t) ? Date.now() : t; };
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; };
const $ = id => document.getElementById(id);

const S = load();
const UI = { tab: 'now', sheet: null };

function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { config: o.config || null, cur: o.cur || { sleep: null, feed: null }, events: Array.isArray(o.events) ? o.events : [] };
  } catch (e) { return { config: null, cur: { sleep: null, feed: null }, events: [] }; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Не сохранилось: память браузера заполнена'); }
}
function commit() { S.events.sort((a, b) => a.start - b.start); save(); refresh(); }
function putEvent(ev) { const i = S.events.findIndex(e => e.id === ev.id); if (i >= 0) S.events[i] = ev; else S.events.push(ev); commit(); }
function delEvent(id) { S.events = S.events.filter(e => e.id !== id); commit(); }
function setCur(c) { S.cur = c; commit(); }

/* ================= расчёты ================= */
function ageOf(birth) {
  if (!birth) return null;
  const b = new Date(birth + 'T00:00'); if (isNaN(b)) return null;
  const n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--;
  const a = new Date(b); a.setMonth(b.getMonth() + m);
  const d = Math.floor((n - a) / DAY), days = Math.floor((n - b) / DAY);
  let label;
  if (days < 0) label = 'скоро родится';
  else if (m < 1) label = days + ' ' + plural(days, 'день', 'дня', 'дней');
  else if (m < 12) label = m + ' мес' + (d ? ' ' + d + ' дн' : '');
  else { const y = Math.floor(m / 12), mm = m % 12; label = y + ' ' + plural(y, 'год', 'года', 'лет') + (mm ? ' ' + mm + ' мес' : ''); }
  return { m: Math.max(0, m), d, days, label };
}
const normFor = age => age ? (NORMS.find(n => age.m >= n.from && age.m < n.to) || NORMS[NORMS.length - 1]) : null;
const overlap = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
function lastOf(pred) { for (let i = S.events.length - 1; i >= 0; i--) if (pred(S.events[i])) return S.events[i]; return null; }
function stats(from, to) {
  let sleep = 0, feeds = 0, ml = 0, solids = 0, wet = 0, dirty = 0;
  for (const e of S.events) {
    if (e.type === 'sleep') sleep += overlap(e.start, e.end || to, from, to);
    if (e.start < from || e.start >= to) continue;
    if (e.type === 'feed') { if (e.kind === 'solid') solids++; else { feeds++; if (e.kind === 'bottle') ml += +e.ml || 0; } }
    if (e.type === 'diaper') { if (e.pee) wet++; if (e.poo) dirty++; }
  }
  if (S.cur.sleep) sleep += overlap(S.cur.sleep.start, Date.now(), from, to);
  return { sleep, feeds, ml, solids, wet, dirty };
}
function formulaDaily() {
  const c = S.config, age = c && ageOf(c.birth);
  if (!c || !c.weight || c.feedType === 'breast' || !age || age.m >= 6) return 0;
  return Math.min(960, Math.round(c.weight * 165 / 10) * 10);
}
function feedSides(f, now) {
  let L = 0, R = 0;
  f.segs.forEach((s, i) => { const end = i < f.segs.length - 1 ? f.segs[i + 1].start : now; const d = end - s.start; if (s.side === 'L') L += d; else R += d; });
  return { L, R };
}

/* ================= иконки ================= */
const IC = {
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  bottle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M10 2.5h4v2.5h-4zM9 5h6l1.5 3v11.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V8z"/><path d="M7.5 12h4M7.5 16h4"/></svg>',
  diaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 6h18v4c0 5-4 9-9 9s-9-4-9-9z"/><path d="M3 10c3 0 5 2 5.5 5M21 10c-3 0-5 2-5.5 5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  spoon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><ellipse cx="12" cy="7" rx="4" ry="5"/><path d="M12 12v9"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/></svg>'
};
$('dkFeedIc').innerHTML = IC.bottle; $('dkDiaperIc').innerHTML = IC.diaper; $('dkMoreIc').innerHTML = IC.plus;

function view(e) {
  if (e.type === 'sleep') return { c: 'var(--sleep)', ic: IC.moon, t: 'Сон', d: e.end ? hm(e.start) + '–' + hm(e.end) : '', r: e.end ? durS(e.end - e.start) : '' };
  if (e.type === 'feed') {
    if (e.kind === 'breast') { const L = Math.round((e.left || 0) / 60), R = Math.round((e.right || 0) / 60); return { c: 'var(--feed)', ic: IC.drop, t: 'Грудь', d: [L ? 'левая ' + L + ' мин' : '', R ? 'правая ' + R + ' мин' : ''].filter(Boolean).join(' · ') || '—', r: (L + R) ? (L + R) + 'м' : '' }; }
    if (e.kind === 'bottle') return { c: 'var(--feed)', ic: IC.bottle, t: (e.ml || 0) + ' мл', d: e.bk === 'expressed' ? 'сцеженное молоко' : 'смесь', r: '' };
    return { c: 'var(--feed)', ic: IC.spoon, t: 'Прикорм', d: e.what || '', r: '' };
  }
  if (e.type === 'diaper') return { c: 'var(--diaper)', ic: IC.diaper, t: 'Подгузник', d: e.pee && e.poo ? 'мокрый и грязный' : e.poo ? 'грязный' : 'мокрый', r: '' };
  const names = { temp: 'Температура', weight: 'Вес', med: 'Лекарство', note: 'Заметка' }, unit = { temp: ' °C', weight: ' кг' }[e.sub];
  return { c: 'var(--other)', ic: IC.note, t: (names[e.sub] || 'Заметка') + (unit && e.value ? ' ' + e.value + unit : ''), d: unit ? (e.note || '') : (e.value || ''), r: '' };
}

/* ================= циферблат ================= */
const C = 180, R_SLEEP = 146, R_FEED = 121, R_DIAP = 108;
const ang = t => { const d = new Date(t); return ((d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60) / 1440) * 360; };
const pt = (r, a) => { const rad = (a - 90) * Math.PI / 180; return [C + r * Math.cos(rad), C + r * Math.sin(rad)]; };
function arcPath(r, a0, a1) {
  let sweep = a1 - a0; if (sweep < 0) sweep += 360; if (sweep < 0.6) sweep = 0.6; if (sweep > 359.5) sweep = 359.5;
  const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a0 + sweep);
  return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + (sweep > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
}
function drawDial() {
  const now = Date.now(), from = now - DAY + 6e4;
  const fade = t => (0.32 + 0.68 * Math.min(1, Math.max(0, (t - from) / DAY))).toFixed(2);
  let g = '';
  g += '<circle cx="' + C + '" cy="' + C + '" r="' + R_SLEEP + '" fill="none" stroke="var(--bg2)" stroke-width="22"/>';
  g += '<circle cx="' + C + '" cy="' + C + '" r="' + (R_SLEEP + 11) + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  g += '<circle cx="' + C + '" cy="' + C + '" r="' + (R_SLEEP - 11) + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  for (let h = 0; h < 24; h++) {
    const a = h * 15, major = h % 6 === 0, [x0, y0] = pt(R_SLEEP + 15, a), [x1, y1] = pt(R_SLEEP + (major ? 22 : 18), a);
    g += '<line x1="' + x0.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="var(--' + (major ? 'muted' : 'line') + ')" stroke-width="' + (major ? 2 : 1.5) + '" stroke-linecap="round"/>';
  }
  [[0, '0'], [6, '6'], [12, '12'], [18, '18']].forEach(([h, l]) => { const [x, y] = pt(R_SLEEP + 31, h * 15); g += '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="middle">' + l + '</text>'; });
  // окно для сна
  const age = ageOf(S.config.birth), n = normFor(age);
  if (!S.cur.sleep && n) {
    const ls = lastOf(e => e.type === 'sleep' && e.end);
    if (ls && now - ls.end < 8 * H) {
      const a0 = ang(ls.end + n.wake[0] * 6e4), a1 = ang(ls.end + n.wake[1] * 6e4);
      g += '<path d="' + arcPath(R_SLEEP, a0, a1) + '" fill="none" stroke="var(--warn)" stroke-opacity=".9" stroke-width="22" stroke-dasharray="2 4"/>';
    }
  }
  // сны
  const sleeps = S.events.filter(e => e.type === 'sleep' && e.end && e.end > from);
  if (S.cur.sleep) sleeps.push({ start: S.cur.sleep.start, end: now, live: true });
  sleeps.forEach(e => {
    const s = Math.max(e.start, from), en = e.end;
    g += '<path class="arc" d="' + arcPath(R_SLEEP, ang(s), ang(en)) + '" fill="none" stroke="var(--sleep)" stroke-width="16" stroke-linecap="round" opacity="' + (e.live ? 1 : fade(en)) + '"/>';
  });
  // кормления
  S.events.filter(e => e.type === 'feed' && e.start > from).forEach(e => {
    const [x, y] = pt(R_FEED, ang(e.start));
    g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (e.kind === 'solid' ? 3.5 : 5.5) + '" fill="var(--feed)" opacity="' + fade(e.start) + '"/>';
  });
  if (S.cur.feed) { const [x, y] = pt(R_FEED, ang(S.cur.feed.start)); g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" fill="none" stroke="var(--feed)" stroke-width="2.5"/>'; }
  // подгузники
  S.events.filter(e => e.type === 'diaper' && e.start > from).forEach(e => {
    const [x, y] = pt(R_DIAP, ang(e.start));
    g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="var(--diaper)" opacity="' + fade(e.start) + '"/>';
  });
  // стрелка «сейчас»
  const an = ang(now), [hx0, hy0] = pt(R_DIAP - 6, an), [hx1, hy1] = pt(R_SLEEP + 13, an);
  g += '<line x1="' + hx0.toFixed(1) + '" y1="' + hy0.toFixed(1) + '" x2="' + hx1.toFixed(1) + '" y2="' + hy1.toFixed(1) + '" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>';
  g += '<circle cx="' + hx1.toFixed(1) + '" cy="' + hy1.toFixed(1) + '" r="4" fill="var(--ink)"/>';
  $('dial').innerHTML = g;
}

/* ================= «Сейчас» ================= */
let centerSince = 0, centerMode = 'hm';
function drawCenter() {
  const now = Date.now(), cEl = $('center'), age = ageOf(S.config.birth), n = normFor(age);
  let label, since, sub, st;
  if (S.cur.sleep) { st = 'st-sleep'; label = 'Спит'; since = S.cur.sleep.start; sub = 'уснул(а) в ' + hm(since); }
  else if (S.cur.feed) { st = 'st-feed'; label = 'Кормление'; since = S.cur.feed.start; const seg = S.cur.feed.segs[S.cur.feed.segs.length - 1]; sub = (seg.side === 'L' ? 'левая' : 'правая') + ' грудь · нажмите'; }
  else {
    st = 'st-awake'; label = 'Не спит';
    const ls = lastOf(e => e.type === 'sleep' && e.end);
    if (ls) {
      since = ls.end;
      if (n) {
        const m = (now - ls.end) / 6e4;
        sub = m < n.wake[0] ? 'окно сна ' + hm(ls.end + n.wake[0] * 6e4) + '–' + hm(ls.end + n.wake[1] * 6e4)
          : m <= n.wake[1] ? 'пора укладывать<br>до ' + hm(ls.end + n.wake[1] * 6e4)
          : 'дольше нормы —<br>укладывайте';
      } else sub = 'проснулся(ась) в ' + hm(ls.end);
    } else { since = 0; sub = 'нажмите «Уснул»,<br>когда заснёт'; }
  }
  cEl.className = 'center ' + st;
  $('cLabel').textContent = label;
  $('cSub').innerHTML = sub;
  centerSince = since; centerMode = S.cur.feed && !S.cur.sleep ? 'sec' : 'hm';
  tickCenter();
}
function tickCenter() {
  const el = $('cTimer'), now = Date.now();
  const t = centerSince ? (centerMode === 'sec' ? clock(now - centerSince) : clockHM(now - centerSince)) : '—';
  if (el.textContent !== t) el.textContent = t;
  if (S.cur.feed) { const ft = $('dkFeedT'); const v = clock(now - S.cur.feed.start); if (ft.textContent !== v) ft.textContent = v; const lf = $('lfBig'); if (lf && lf.textContent !== v) lf.textContent = v; }
  if (S.cur.sleep) { const st = $('dkSleepT'), v = clockHM(now - S.cur.sleep.start); if (st.textContent !== v) st.textContent = v; }
}
function drawDock() {
  const s = $('dkSleep'), f = $('dkFeed');
  s.classList.toggle('live', !!S.cur.sleep);
  $('dkSleepIc').innerHTML = S.cur.sleep ? IC.sun : IC.moon;
  if (!S.cur.sleep) $('dkSleepT').textContent = 'Уснул';
  s.setAttribute('aria-label', S.cur.sleep ? 'Проснулся' : 'Уснул');
  f.classList.toggle('live', !!S.cur.feed);
  if (!S.cur.feed) $('dkFeedT').textContent = 'Еда';
}
function drawCues() {
  const now = Date.now(), out = [];
  const lf = lastOf(e => e.type === 'feed' && e.kind !== 'solid');
  const lb = lastOf(e => e.type === 'feed' && e.kind === 'breast' && e.lastSide);
  if (S.cur.feed) out.push(['var(--feed)', 'Кормление идёт', 'с ' + hm(S.cur.feed.start)]);
  else if (lf) out.push(['var(--feed)', 'Ели <b>' + dur(now - lf.start) + '</b> назад', hm(lf.start)]);
  else out.push(['var(--feed)', 'Кормлений пока нет', '']);
  if (lb && !S.cur.feed) out.push(['var(--feed)', 'Дальше — <b>' + (lb.lastSide === 'L' ? 'правая' : 'левая') + '</b> грудь', 'была ' + (lb.lastSide === 'L' ? 'левая' : 'правая')]);
  else {
    const ld = lastOf(e => e.type === 'diaper');
    out.push(['var(--diaper)', ld ? 'Подгузник <b>' + dur(now - ld.start) + '</b> назад' : 'Подгузников пока нет', ld ? hm(ld.start) : '']);
  }
  $('cues').innerHTML = out.map(([c, t, k]) => '<div class="cue"><span class="dot" style="background:' + c + '"></span><span>' + t + '</span><span class="k">' + k + '</span></div>').join('');
}
function drawMeters() {
  const now = Date.now(), from = now - DAY, st = stats(from, now);
  const age = ageOf(S.config.birth), n = normFor(age);
  const first = S.events.length ? S.events[0].start : now, partial = first > from + H;
  const tag = (v, lo, hi) => partial ? '<span class="tag na">мало данных</span>' : v < lo ? '<span class="tag ' + (hi == null ? 'bad' : 'warn') + '">меньше нормы</span>' : (hi != null && v > hi) ? '<span class="tag warn">больше нормы</span>' : '<span class="tag good">в норме</span>';
  const bar = (v, lo, hi, max, col) => '<div class="bar"><span class="z" style="left:' + (lo / max * 100).toFixed(1) + '%;width:' + (((hi || max) - lo) / max * 100).toFixed(1) + '%"></span><i style="width:' + Math.min(100, v / max * 100).toFixed(1) + '%;background:' + col + '"></i></div>';
  const m = [];
  const sh = st.sleep / H;
  m.push('<div class="meter"><span class="mv">' + durS(st.sleep) + '</span>' + (n ? bar(sh, n.sleep[0], n.sleep[1], 20, 'var(--sleep)') + tag(sh, n.sleep[0], n.sleep[1]) : '') + '<span class="mn">сон' + (n ? ' · норма ' + n.sleep[0] + '–' + n.sleep[1] + ' ч' : '') + '</span></div>');
  m.push('<div class="meter"><span class="mv">' + st.feeds + ' ' + plural(st.feeds, 'раз', 'раза', 'раз') + '</span>' + (n ? bar(st.feeds, n.feeds[0], n.feeds[1], 14, 'var(--feed)') + tag(st.feeds, n.feeds[0], n.feeds[1] + 2) : '') + '<span class="mn">кормлений' + (n ? ' · норма ' + n.feeds[0] + '–' + n.feeds[1] : '') + (st.solids ? ' · прикорм ' + st.solids : '') + '</span></div>');
  const fml = formulaDaily();
  if (fml || st.ml) m.push('<div class="meter"><span class="mv">' + st.ml + ' мл</span>' + (fml ? bar(st.ml, fml * 0.85, fml, 1000, 'var(--feed)') + tag(st.ml, fml * 0.7, null) : '') + '<span class="mn">' + (fml ? 'смесь · ориентир ~' + fml + ' мл' : 'из бутылочки') + '</span></div>');
  const wetOk = age && age.days >= 7;
  m.push('<div class="meter"><span class="mv">' + st.wet + ' / ' + st.dirty + '</span>' + (wetOk ? bar(st.wet, 6, null, 12, 'var(--diaper)') + tag(st.wet, 6, null) : '') + '<span class="mn">мокрых / грязных' + (wetOk ? ' · норма от 6 мокрых' : '') + '</span></div>');
  if (m.length % 2) m.push('<div class="meter" style="visibility:hidden"></div>');
  $('meters').innerHTML = m.join('');
}
function drawLog() {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0); const today = t0.getTime();
  const group = (title, from, to, emptyTxt) => {
    const list = S.events.filter(e => e.start >= from && e.start < to).reverse();
    let h = '<div class="day-h">' + title + '</div>';
    if (!list.length) return h + '<div class="empty">' + emptyTxt + '</div>';
    return h + list.map(e => { const v = view(e); return '<button class="ev" data-act="edit" data-id="' + e.id + '"><span class="t">' + hm(e.start) + '</span><span class="ic" style="color:' + v.c + ';background:color-mix(in srgb,' + v.c + ' 16%,transparent)">' + v.ic + '</span><span class="w">' + esc(v.t) + '<span>' + esc(v.d) + '</span></span><span class="d">' + v.r + '</span></button>'; }).join('');
  };
  $('log').innerHTML = group('Сегодня', today, Infinity, 'Пока пусто — записи появятся здесь после первого нажатия внизу.') + group('Вчера', today - DAY, today, 'Записей нет.');
}

/* ================= неделя / нормы / профиль ================= */
function drawWeek() {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const first = S.events.length ? S.events[0].start : Date.now();
  let h = '<div class="axis"><div></div><div><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div></div>';
  let tot = 0, ft = 0, cnt = 0;
  for (let i = 0; i < 7; i++) {
    const from = t0.getTime() - i * DAY, to = from + DAY, end = Math.min(to, Date.now()), d = new Date(from), st = stats(from, end);
    let bars = [6, 12, 18].map(x => '<span class="g" style="left:' + (x / 24 * 100) + '%"></span>').join('');
    const sl = S.events.filter(e => e.type === 'sleep');
    if (S.cur.sleep) sl.push({ start: S.cur.sleep.start, end: Date.now() });
    sl.forEach(e => { const a = Math.max(e.start, from), b = Math.min(e.end || Date.now(), to); if (b > a) bars += '<span class="s" style="left:' + ((a - from) / DAY * 100).toFixed(2) + '%;width:' + Math.max(.8, (b - a) / DAY * 100).toFixed(2) + '%"></span>'; });
    S.events.forEach(e => { if (e.type === 'feed' && e.kind !== 'solid' && e.start >= from && e.start < to) bars += '<span class="f" style="left:' + ((e.start - from) / DAY * 100).toFixed(2) + '%"></span>'; });
    const name = i === 0 ? 'Сегодня' : i === 1 ? 'Вчера' : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()];
    h += '<div class="wrow"><div class="wd">' + name + '<span>' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '</span></div><div class="stripe">' + bars + '</div><div class="wtot">сон ' + durS(st.sleep) + ' · ' + st.feeds + ' корм.' + (st.ml ? ' · ' + st.ml + ' мл' : '') + ' · ' + st.wet + ' мокр.</div></div>';
    if (i > 0 && from >= first - DAY && S.events.some(e => e.start >= from && e.start < to)) { tot += st.sleep; ft += st.feeds; cnt++; }
  }
  $('week').innerHTML = h;
  $('weekAvg').innerHTML = '<div class="block-h"><h2>В среднем за сутки</h2><span class="hint">полные дни</span></div>' + (cnt
    ? '<div class="stats"><div class="stat"><b>' + durS(tot / cnt) + '</b><span>сон</span></div><div class="stat"><b>' + (ft / cnt).toFixed(1).replace('.', ',') + '</b><span>кормлений</span></div><div class="stat"><b>' + cnt + '</b><span>' + plural(cnt, 'день', 'дня', 'дней') + ' в расчёте</span></div></div>'
    : '<p class="p">Появится после первого полного дня записей.</p>');
}
function drawNorms() {
  const age = ageOf(S.config.birth), n = normFor(age), fml = formulaDaily();
  let h = '';
  if (n) h += '<div class="now-norm"><h2>Сейчас · ' + n.label + '</h2>' +
    '<div class="nn"><b>' + n.wake[0] + '–' + n.wake[1] + ' мин</b><span>бодрствование</span></div>' +
    '<div class="nn"><b>' + n.sleep[0] + '–' + n.sleep[1] + ' ч</b><span>сон за сутки</span></div>' +
    '<div class="nn"><b>' + n.naps + '</b><span>дневных снов</span></div>' +
    '<div class="nn"><b>' + n.feeds[0] + '–' + n.feeds[1] + '</b><span>кормлений' + (n.solids ? ' + прикорм' : '') + '</span></div>' +
    (n.ml ? '<div class="nn"><b>' + n.ml[0] + '–' + n.ml[1] + ' мл</b><span>бутылочка за раз</span></div>' : '') +
    (fml ? '<div class="nn"><b>~' + fml + ' мл</b><span>смеси в сутки по весу</span></div>' : '<div class="nn"><b>от 6</b><span>мокрых в сутки</span></div>') + '</div>';
  h += '<div class="block"><h2>Все возрасты</h2><div class="tbl"><table><thead><tr><th>Возраст</th><th>Бодрств.</th><th>Сон</th><th>Снов днём</th><th>Кормлений</th><th>Бутылочка</th></tr></thead><tbody>' +
    NORMS.map(x => '<tr' + (x === n ? ' class="cur"' : '') + '><td>' + x.label + '</td><td>' + x.wake[0] + '–' + x.wake[1] + ' мин</td><td>' + x.sleep[0] + '–' + x.sleep[1] + ' ч</td><td>' + x.naps + '</td><td>' + x.feeds[0] + '–' + x.feeds[1] + (x.solids ? ' + прикорм' : '') + '</td><td>' + (x.ml ? x.ml[0] + '–' + x.ml[1] + ' мл' : '—') + '</td></tr>').join('') +
    '</tbody></table></div><p class="p">Средние ориентиры: сон — AASM, объёмы смеси — AAP (около 165 мл на кг в сутки, не больше 960 мл), окна бодрствования — сводные таблицы. Грудничков кормят по требованию. Главное — прибавка в весе и самочувствие, а не попадание в таблицу.</p></div>';
  h += '<div class="block"><h2>Когда звонить педиатру</h2><ul class="alarm"><li>Температура 38 °C и выше у малыша младше 3 месяцев — сразу к врачу.</li><li>Меньше 6 мокрых подгузников за сутки после первой недели, сухие губы, впавший родничок.</li><li>Отказ от еды несколько кормлений подряд, вялость, трудно разбудить.</li><li>Рвота фонтаном, кровь в стуле, тяжёлое дыхание.</li></ul></div>';
  $('norms').innerHTML = h;
}
function cfgFields(c) {
  return '<label class="field">Имя<input id="cfName" required value="' + esc(c.name || '') + '" placeholder="Как зовут малыша" autocomplete="off"></label>' +
    '<label class="field">Дата рождения<input id="cfBirth" type="date" required value="' + esc(c.birth || '') + '"></label>' +
    '<div class="row2"><label class="field">Вес, кг<input id="cfWeight" inputmode="decimal" value="' + esc(c.weight || '') + '" placeholder="4,2"></label><label class="field">Рост, см<input id="cfHeight" inputmode="decimal" value="' + esc(c.height || '') + '" placeholder="54"></label></div>' +
    '<label class="field">Как кормите<select id="cfFeed">' + [['breast', 'Грудью'], ['mixed', 'Смешанное'], ['formula', 'Смесью']].map(([v, l]) => '<option value="' + v + '"' + (c.feedType === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>';
}
function drawProfile() { $('cfgForm').innerHTML = cfgFields(S.config) + '<button class="btn" type="submit">Сохранить</button>'; }

/* ================= обновление ================= */
function refresh() {
  if (!S.config || !S.config.name) {
    $('app').hidden = true; $('onboard').hidden = false;
    if (!$('obForm').innerHTML) $('obForm').innerHTML = cfgFields({ feedType: 'breast' }) + '<button class="btn" type="submit">Начать дневник</button>';
    return;
  }
  $('onboard').hidden = true; $('app').hidden = false;
  $('hName').textContent = S.config.name;
  const age = ageOf(S.config.birth); $('hAge').textContent = age ? age.label : '';
  drawDock();
  if (UI.tab === 'now') { drawDial(); drawCenter(); drawCues(); drawMeters(); drawLog(); }
  else if (UI.tab === 'week') drawWeek();
  else if (UI.tab === 'norms') drawNorms();
  else if (UI.tab === 'profile' && !document.activeElement.closest('#cfgForm')) drawProfile();
  if (UI.sheet === 'feedLive') renderFeedLive();
}
function setTab(t) {
  if (UI.tab === t) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  UI.tab = t;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === t ? 'page' : 'false'));
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.dataset.view !== t; });
  moveInk(); window.scrollTo(0, 0); refresh();
}
function moveInk() {
  const b = document.querySelector('.tab[aria-current="page"]'), ink = $('tabInk');
  if (!b) return;
  ink.style.width = b.offsetWidth + 'px';
  ink.style.transform = 'translateX(' + (b.offsetLeft - 4) + 'px)';
}

/* ================= шторки ================= */
const root = $('sheetRoot'), sheet = $('sheet'), body = $('sheetBody');
let ctx = {};
function openSheet(name, title, html) {
  UI.sheet = name; $('sheetTitle').textContent = title; body.innerHTML = html;
  if (root.hidden) {
    root.hidden = false; document.body.classList.add('lock');
    sheet.getBoundingClientRect();
    requestAnimationFrame(() => root.classList.add('open'));
  }
}
function closeSheet() {
  if (root.hidden) return;
  UI.sheet = null; root.classList.remove('open'); document.body.classList.remove('lock');
  sheet.style.transform = '';
  setTimeout(() => { if (!UI.sheet) { root.hidden = true; body.innerHTML = ''; ctx = {}; } }, 320);
}
(function dragToClose() {
  let y0 = null, dy = 0;
  const start = e => { if (e.target.closest('.x')) return; y0 = e.touches[0].clientY; dy = 0; sheet.classList.add('drag'); };
  const move = e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = 'translateY(' + dy + 'px)'; };
  const end = () => { if (y0 == null) return; sheet.classList.remove('drag'); y0 = null; if (dy > 90) closeSheet(); else sheet.style.transform = ''; };
  [$('grab'), document.querySelector('.sheet-h')].forEach(el => { el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchmove', move, { passive: true }); el.addEventListener('touchend', end); });
})();
const timeField = (id, label, t) => '<label class="field">' + label + '<input id="' + id + '" type="datetime-local" value="' + toInput(t || Date.now()) + '"></label>';
const val = id => { const el = $(id); return el ? el.value : ''; };

function feedSheet(tab) {
  if (S.cur.feed) return feedLiveSheet();
  tab = tab || ctx.ftab || (S.config.feedType === 'formula' ? 'bottle' : 'breast');
  ctx = { ftab: tab, ml: ctx.ml || null };
  let b = '<div class="seg">' + [['breast', 'Грудь'], ['bottle', 'Бутылочка'], ['solid', 'Прикорм']].map(([k, l]) => '<button data-act="ftab" data-k="' + k + '" aria-pressed="' + (tab === k) + '">' + l + '</button>').join('') + '</div>';
  if (tab === 'breast') {
    const lb = lastOf(e => e.type === 'feed' && e.kind === 'breast' && e.lastSide), nx = lb ? (lb.lastSide === 'L' ? 'R' : 'L') : null;
    b += '<div class="pair"><button class="btn" data-act="breast-start" data-side="L">Левая<small>' + (nx === 'L' ? 'на очереди' : 'старт таймера') + '</small></button><button class="btn" data-act="breast-start" data-side="R">Правая<small>' + (nx === 'R' ? 'на очереди' : 'старт таймера') + '</small></button></div>';
    b += '<div class="day-h">Задним числом</div>' + timeField('fT', 'Начало', Date.now() - 20 * 6e4) + '<div class="row2"><label class="field">Левая, мин<input id="fL" inputmode="numeric"></label><label class="field">Правая, мин<input id="fR" inputmode="numeric"></label></div><button class="btn ghost" data-act="save-breast">Сохранить</button>';
  } else if (tab === 'bottle') {
    const n = normFor(ageOf(S.config.birth));
    b += '<div class="chips">' + [30, 60, 90, 120, 150, 180, 210, 240].map(v => '<button data-act="ml" data-v="' + v + '" aria-pressed="' + (ctx.ml === v) + '">' + v + '</button>').join('') + '</div>';
    b += '<div class="row2"><label class="field">Съел(а), мл<input id="fMl" inputmode="numeric" value="' + (ctx.ml || '') + '"></label><label class="field">Что<select id="fBk"><option value="formula">Смесь</option><option value="expressed">Сцеженное</option></select></label></div>' + (n && n.ml ? '<p class="p" style="margin:0">Ориентир для ' + n.label + ': ' + n.ml[0] + '–' + n.ml[1] + ' мл за раз.</p>' : '') + timeField('fT', 'Время') + '<button class="btn" data-act="save-bottle">Сохранить</button>';
  } else {
    b += '<label class="field">Что и сколько<input id="fWhat" placeholder="Кабачок, 2 ч. л."></label>' + timeField('fT', 'Время') + '<button class="btn" data-act="save-solid">Сохранить</button>';
  }
  openSheet('feed', 'Кормление', b);
}
function feedLiveSheet() {
  openSheet('feedLive', 'Кормление идёт', '<div class="live-feed"><div class="big" id="lfBig">' + clock(Date.now() - S.cur.feed.start) + '</div><span class="p" style="margin:0">началось в ' + hm(S.cur.feed.start) + '</span></div><div class="sides" id="lfSides"></div><div class="row2"><button class="btn ghost" data-act="breast-switch">Сменить грудь</button><button class="btn" data-act="feed-stop">Закончить</button></div><button class="btn danger" data-act="feed-cancel">Отменить без записи</button>');
  renderFeedLive();
}
function renderFeedLive() {
  const el = $('lfSides'); if (!el || !S.cur.feed) return;
  const now = Date.now(), f = S.cur.feed, s = feedSides(f, now), cur = f.segs[f.segs.length - 1].side;
  el.innerHTML = '<div class="side' + (cur === 'L' ? ' on' : '') + '"><b>' + clock(s.L) + '</b><span>левая</span></div><div class="side' + (cur === 'R' ? ' on' : '') + '"><b>' + clock(s.R) + '</b><span>правая</span></div>';
}
function diaperSheet() { openSheet('diaper', 'Подгузник', '<div class="trio"><button class="btn" data-act="diaper" data-k="pee">Мокрый</button><button class="btn" data-act="diaper" data-k="poo">Грязный</button><button class="btn" data-act="diaper" data-k="both">Оба</button></div>' + timeField('fT', 'Время (если не сейчас)')); }
function moreSheet(sub) {
  sub = sub || 'sleep'; ctx = { osub: sub };
  let b = '<div class="seg">' + [['sleep', 'Сон'], ['temp', 't°'], ['weight', 'Вес'], ['med', 'Лекарство'], ['note', 'Заметка']].map(([k, l]) => '<button data-act="osub" data-k="' + k + '" aria-pressed="' + (sub === k) + '">' + l + '</button>').join('') + '</div>';
  if (sub === 'sleep') b += '<p class="p" style="margin:0">Если забыли нажать «Уснул».</p>' + timeField('oA', 'Уснул(а)', Date.now() - H) + timeField('oB', 'Проснулся(ась)');
  else if (sub === 'temp') b += '<label class="field">Температура, °C<input id="oV" inputmode="decimal" placeholder="36,8"></label>' + timeField('oA', 'Время');
  else if (sub === 'weight') b += '<div class="row2"><label class="field">Вес, кг<input id="oV" inputmode="decimal" value="' + esc(S.config.weight || '') + '"></label><label class="field">Рост, см<input id="oH" inputmode="decimal" value="' + esc(S.config.height || '') + '"></label></div>' + timeField('oA', 'Дата замера');
  else if (sub === 'med') b += '<label class="field">Что и доза<input id="oV" placeholder="Название, доза"></label>' + timeField('oA', 'Время');
  else b += '<label class="field">Заметка<input id="oV" placeholder="Прививка, колики, первая улыбка…"></label>' + timeField('oA', 'Время');
  b += '<button class="btn" data-act="save-more">Сохранить</button>';
  openSheet('more', 'Добавить', b);
}
function editSheet(id) {
  const e = S.events.find(x => x.id === id); if (!e) return; ctx = { edit: e };
  let b = timeField('eA', e.type === 'sleep' ? 'Уснул(а)' : 'Время', e.start);
  if (e.type === 'sleep') b += timeField('eB', 'Проснулся(ась)', e.end || Date.now());
  if (e.type === 'feed' && e.kind === 'breast') b += '<div class="row2"><label class="field">Левая, мин<input id="eL" inputmode="numeric" value="' + Math.round((e.left || 0) / 60) + '"></label><label class="field">Правая, мин<input id="eR" inputmode="numeric" value="' + Math.round((e.right || 0) / 60) + '"></label></div>';
  if (e.type === 'feed' && e.kind === 'bottle') b += '<label class="field">Объём, мл<input id="eMl" inputmode="numeric" value="' + (e.ml || 0) + '"></label>';
  if (e.type === 'feed' && e.kind === 'solid') b += '<label class="field">Что и сколько<input id="eW" value="' + esc(e.what || '') + '"></label>';
  if (e.type === 'diaper') b += '<label class="check"><input id="eP" type="checkbox"' + (e.pee ? ' checked' : '') + '> Мокрый</label><label class="check"><input id="eD" type="checkbox"' + (e.poo ? ' checked' : '') + '> Грязный</label>';
  if (e.type === 'other') b += '<label class="field">Значение<input id="eV" value="' + esc(e.value || '') + '"></label>';
  b += '<button class="btn" data-act="save-edit">Сохранить</button><button class="btn danger" data-act="del-edit">Удалить запись</button>';
  openSheet('edit', view(e).t, b);
}

/* ================= действия ================= */
let toastT;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act],[data-tab]'); if (!el) return;
  if (el.dataset.tab) return setTab(el.dataset.tab);
  const a = el.dataset.act, now = Date.now();
  switch (a) {
    case 'close': closeSheet(); break;
    case 'sleep-toggle':
      if (S.cur.sleep) { const st = S.cur.sleep.start; if (now - st < 6e4) { setCur({ ...S.cur, sleep: null }); toast('Меньше минуты — не записал'); break; } S.cur = { ...S.cur, sleep: null }; putEvent({ id: uid(), type: 'sleep', start: st, end: now }); toast('Сон записан · ' + dur(now - st)); }
      else { setCur({ ...S.cur, sleep: { start: now } }); toast('Сон пошёл'); }
      break;
    case 'sheet-feed': feedSheet(); break;
    case 'sheet-diaper': diaperSheet(); break;
    case 'sheet-more': moreSheet(); break;
    case 'ftab': feedSheet(el.dataset.k); break;
    case 'osub': moreSheet(el.dataset.k); break;
    case 'ml': ctx.ml = +el.dataset.v; $('fMl').value = el.dataset.v; el.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === el)); break;
    case 'breast-start': setCur({ ...S.cur, feed: { start: now, segs: [{ side: el.dataset.side, start: now }] } }); feedLiveSheet(); break;
    case 'breast-switch': { const f = S.cur.feed; if (!f) break; const last = f.segs[f.segs.length - 1]; setCur({ ...S.cur, feed: { ...f, segs: [...f.segs, { side: last.side === 'L' ? 'R' : 'L', start: now }] } }); break; }
    case 'feed-stop': { const f = S.cur.feed; if (!f) break; const s = feedSides(f, now); S.cur = { ...S.cur, feed: null };
      putEvent({ id: uid(), type: 'feed', kind: 'breast', start: f.start, end: now, left: Math.round(s.L / 1000), right: Math.round(s.R / 1000), lastSide: f.segs[f.segs.length - 1].side });
      closeSheet(); toast('Кормление записано · ' + dur(now - f.start)); break; }
    case 'feed-cancel': if (el.dataset.sure) { setCur({ ...S.cur, feed: null }); closeSheet(); toast('Кормление отменено'); } else { el.dataset.sure = '1'; el.textContent = 'Нажмите ещё раз, чтобы отменить'; } break;
    case 'save-breast': { const L = num(val('fL')) || 0, R = num(val('fR')) || 0; if (!L && !R) { toast('Укажите минуты хотя бы для одной груди'); break; } const t = fromInput(val('fT'));
      putEvent({ id: uid(), type: 'feed', kind: 'breast', start: t, end: t + (L + R) * 6e4, left: L * 60, right: R * 60, lastSide: R && !L ? 'R' : L && !R ? 'L' : 'R' }); closeSheet(); toast('Кормление записано'); break; }
    case 'save-bottle': { const ml = num(val('fMl')); if (!ml) { toast('Укажите объём в мл'); break; } putEvent({ id: uid(), type: 'feed', kind: 'bottle', start: fromInput(val('fT')), ml, bk: val('fBk') }); closeSheet(); toast('Записано · ' + ml + ' мл'); break; }
    case 'save-solid': putEvent({ id: uid(), type: 'feed', kind: 'solid', start: fromInput(val('fT')), what: val('fWhat').trim() }); closeSheet(); toast('Прикорм записан'); break;
    case 'diaper': { const k = el.dataset.k; putEvent({ id: uid(), type: 'diaper', start: fromInput(val('fT')), pee: k !== 'poo', poo: k !== 'pee' }); closeSheet(); toast('Подгузник записан'); break; }
    case 'save-more': {
      const sub = ctx.osub;
      if (sub === 'sleep') { const A = fromInput(val('oA')), B = fromInput(val('oB')); if (B <= A) { toast('Пробуждение должно быть позже засыпания'); break; } putEvent({ id: uid(), type: 'sleep', start: A, end: B }); }
      else {
        const v = val('oV').trim(); if (!v) { toast('Заполните поле'); break; }
        if (sub === 'weight') { const w = num(v), h = num(val('oH')); S.config = { ...S.config, weight: w || S.config.weight || null, height: h || S.config.height || null }; putEvent({ id: uid(), type: 'other', sub: 'weight', start: fromInput(val('oA')), value: String(w || v).replace('.', ','), note: h ? 'рост ' + h + ' см' : '' }); }
        else putEvent({ id: uid(), type: 'other', sub, start: fromInput(val('oA')), value: sub === 'temp' ? v.replace('.', ',') : v });
      }
      closeSheet(); toast('Записано'); break;
    }
    case 'edit': editSheet(el.dataset.id); break;
    case 'save-edit': {
      const e = ctx.edit; if (!e) break; const n = { ...e, start: fromInput(val('eA')) };
      if (e.type === 'sleep') { n.end = fromInput(val('eB')); if (n.end <= n.start) { toast('Пробуждение должно быть позже засыпания'); break; } }
      if (e.type === 'feed' && e.kind === 'breast') { n.left = (num(val('eL')) || 0) * 60; n.right = (num(val('eR')) || 0) * 60; n.end = n.start + (n.left + n.right) * 1000; }
      if (e.type === 'feed' && e.kind === 'bottle') n.ml = num(val('eMl')) || 0;
      if (e.type === 'feed' && e.kind === 'solid') n.what = val('eW').trim();
      if (e.type === 'diaper') { n.pee = $('eP').checked; n.poo = $('eD').checked; }
      if (e.type === 'other') n.value = val('eV').trim();
      putEvent(n); closeSheet(); toast('Сохранено'); break;
    }
    case 'del-edit': if (el.dataset.sure) { delEvent(ctx.edit.id); closeSheet(); toast('Запись удалена'); } else { el.dataset.sure = '1'; el.textContent = 'Нажмите ещё раз, чтобы удалить'; } break;
    case 'export': exportData(); break;
    case 'wipe': if (el.dataset.sure) { S.events = []; S.cur = { sleep: null, feed: null }; commit(); el.removeAttribute('data-sure'); el.textContent = 'Удалить все записи'; toast('Все записи удалены'); } else { el.dataset.sure = '1'; el.textContent = 'Точно? Нажмите ещё раз'; } break;
  }
});
$('center').addEventListener('click', () => { if (S.cur.feed && !S.cur.sleep) feedLiveSheet(); else if (!S.cur.sleep) setTab('norms'); });

function readCfg() {
  const name = val('cfName').trim(), birth = val('cfBirth');
  if (!name || !birth) { toast('Укажите имя и дату рождения'); return null; }
  return { name, birth, weight: num(val('cfWeight')), height: num(val('cfHeight')), feedType: val('cfFeed') || 'breast' };
}
document.addEventListener('submit', ev => {
  ev.preventDefault();
  const c = readCfg(); if (!c) return;
  if (document.activeElement) document.activeElement.blur();
  S.config = c; commit();
  if (ev.target.id === 'cfgForm') toast('Сохранено'); else { moveInk(); toast('Готово. Первая запись — кнопками внизу'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ================= резервная копия ================= */
function exportData() {
  const blob = new Blob([JSON.stringify({ app: 'malysh', v: 1, exported: new Date().toISOString(), ...S }, null, 1)], { type: 'application/json' });
  const name = 'malysh-' + dayKey(Date.now()) + '.json';
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Дневник малыша' }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
$('importFile').addEventListener('change', async ev => {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (!o || !Array.isArray(o.events)) throw new Error('bad');
    const ids = new Set(S.events.map(e => e.id)); let added = 0;
    o.events.forEach(e => { if (e && e.id && e.start && !ids.has(e.id)) { S.events.push(e); added++; } });
    if (!S.config && o.config) S.config = o.config;
    commit(); toast('Загружено записей: ' + added);
  } catch (e) { toast('Это не файл копии дневника'); }
  ev.target.value = '';
});

/* ================= тики и запуск ================= */
let lastMin = -1;
setInterval(() => {
  if (!S.config || UI.tab !== 'now' || document.hidden) { if (UI.sheet === 'feedLive') { tickCenter(); renderFeedLive(); } return; }
  tickCenter();
  if (UI.sheet === 'feedLive') renderFeedLive();
  const m = Math.floor(Date.now() / 6e4);
  if (m !== lastMin) { lastMin = m; drawDial(); drawCenter(); drawCues(); drawMeters(); }
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastMin = -1; refresh(); } });
window.addEventListener('resize', moveInk);
window.addEventListener('storage', e => { if (e.key === KEY) { const n = load(); S.config = n.config; S.cur = n.cur; S.events = n.events; refresh(); } });

refresh();
requestAnimationFrame(moveInk);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInk);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
