// Vėjo laiptai — page logic (EN / LT)
import { UNITS, byId } from './data.js';
import { t, eur, DL } from './i18n.js';
import { planSVG, roomsOf } from './plans.js';
import { PLANS, TYPES } from './data.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TOUCH = document.documentElement.classList.contains('touch');
const ST = { free: ['st_free', '#4f8a63'], reserved: ['st_reserved', '#d29a3a'], sold: ['st_sold', '#a29d97'] };
const OR = { 'South-west': 'or_sw', 'South-west + south-east': 'or_sw_se', 'South-west + north-west': 'or_sw_nw' };
const tl = u => t('type_' + u.type);
let tT; const toast = m => { const el = $('[data-toast]'); el.textContent = m; el.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => el.classList.remove('on'), 2600); };
const hm = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const monthly = (P, down, yrs, rate) => { const Lm = P * (1 - down / 100), r = rate / 100 / 12, n = yrs * 12; return r ? Lm * r / (1 - (1 + r) ** -n) : Lm / n; };

/* ---------- nav ---------- */
const nav = $('[data-nav]'), mb = $('[data-menu]');
mb.addEventListener('click', () => { const o = !nav.classList.contains('open'); nav.classList.toggle('open', o); mb.setAttribute('aria-expanded', o); mb.textContent = o ? mb.dataset.close : mb.dataset.open; });
$$('[data-sheet] a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); mb.setAttribute('aria-expanded', false); mb.textContent = mb.dataset.open; }));
let scs = null; const onS = () => { const s = scrollY > innerHeight * .75 - 70; if (s !== scs) { scs = s; nav.classList.toggle('sc', s); } };
addEventListener('scroll', onS, { passive: true }); onS();

/* ---------- facts ---------- */
const free = UNITS.filter(u => u.status === 'free'), minP = Math.min(...free.map(u => u.price));
$('[data-count-free]').textContent = t('free_of', { n: free.length, t: UNITS.length });
$('[data-from]').textContent = eur(minP);
$('[data-bar-t]').textContent = t('bar', { n: free.length, p: eur(minP) });
const fill = r => r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
$$('input[type=range]').forEach(r => { fill(r); r.addEventListener('input', () => fill(r)); });

/* ---------- list + filters ---------- */
const F = { rooms: new Set(), max: 560000, onlyFree: true }; let sel = null;
const match = u => (!F.rooms.size || F.rooms.has(u.rooms)) && u.price <= F.max && (!F.onlyFree || u.status === 'free');
function rows() {
  const list = UNITS.filter(match).sort((a, b) => a.price - b.price);
  $('[data-count]').textContent = list.length === 1 ? t('count1') : t('count', { n: list.length });
  $('[data-rows]').innerHTML = list.length ? list.map(u => `<button class="tr" role="row" type="button" data-id="${u.id}" aria-current="${sel === u.id}"><span><span class="st" style="--c:${ST[u.status][1]}"></span><b>${u.id}</b></span><span>${u.rooms}${u.top ? ' · ' + t('ph') : ''}</span><span>${u.area}</span><span>${u.floor + 1}</span><span class="pr">${u.status === 'sold' ? t('st_sold') : eur(u.price)}</span></button>`).join('') : `<p class="empty">${t('empty')}</p>`;
  E && E.filter(match);
}
$('[data-filters]').addEventListener('click', e => { const b = e.target.closest('[data-rooms]'); if (!b) return; const n = +b.dataset.rooms; F.rooms.has(n) ? F.rooms.delete(n) : F.rooms.add(n); b.setAttribute('aria-pressed', F.rooms.has(n)); rows(); });
const mp = $('[data-maxp]'); mp.addEventListener('input', () => { F.max = +mp.value; $('[data-maxp-out]').textContent = F.max >= 560000 ? t('any_price') : eur(F.max); rows(); });
$('[data-maxp-out]').textContent = t('any_price');
$('[data-onlyfree]').addEventListener('change', e => { F.onlyFree = e.target.checked; rows(); });
$('[data-rows]').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; choose(byId(b.dataset.id), true); });

/* ---------- 3D building ---------- */
let E = null, bootP = null; const stage = $('[data-stage]');
// the 3D building is built in small steps, each one waits until no finger is on the screen and scrolling has settled
let touching = 0, lastScroll = 0;
addEventListener('touchstart', () => { touching++; }, { passive: true, capture: true });
const untouch = () => { touching = Math.max(0, touching - 1); lastScroll = performance.now(); };
addEventListener('touchend', untouch, { passive: true, capture: true }); addEventListener('touchcancel', untouch, { passive: true, capture: true });
addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
const gate = () => new Promise(res => { const chk = () => { const w = 260 - (performance.now() - lastScroll); if (touching || w > 0) setTimeout(chk, touching ? 120 : w + 10); else requestAnimationFrame(() => setTimeout(res, 0)); }; chk(); });
function boot() { return bootP || (bootP = (async () => {
  await gate(); const { createEstate } = await import('./estate3d.js?v=20261118c');
  await gate(); E = await createEstate({ pause: gate }); await gate(); await E.warm(); await gate(); E.mount(stage, 'building'); E.overlays(true); E.filter(match);
  E.onPick = u => choose(u, false);
  if (!TOUCH) E.onHover = (u, ev) => { const tip = $('[data-tip]'); if (!u) { tip.hidden = true; return; } const r = stage.getBoundingClientRect(); tip.hidden = false; tip.textContent = `${u.id} · ${tl(u)} · ${u.status === 'sold' ? t('sold_l') : eur(u.price)}`; tip.style.left = (ev.clientX - r.left) + 'px'; tip.style.top = (ev.clientY - r.top - 8) + 'px'; };
  setLight(); requestAnimationFrame(() => $('[data-stage-load]').classList.add('off')); window.__E = E; return E; })()); }
// building the 3D scene takes a moment of main-thread work: never start it mid-swipe, wait for the scroll to settle
const bootIdle = () => boot();
const bio = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { bio.disconnect(); bootIdle(); } }, { rootMargin: '900px' }); bio.observe(stage);
addEventListener('load', () => (window.requestIdleCallback || (f => setTimeout(f, 600)))(bootIdle, { timeout: 1500 }), { once: true });
setTimeout(bootIdle, 2500);

/* ---------- light ---------- */
const lr = $('[data-light-range]'); let season = 'jun';
function setLight() {
  const h = +lr.value; $('[data-light-time]').textContent = hm(h); if (!E) return; const s = E.setSun(h, season);
  $('[data-light-sun]').textContent = s.el <= 0 ? t('after_sunset') : s.el < 8 ? t('low_sun') : t('sun_high', { d: Math.round(s.el) });
}
let lraf = 0; lr.addEventListener('input', () => { cancelAnimationFrame(lraf); lraf = requestAnimationFrame(setLight); });
$$('[name=season]').forEach(r => r.addEventListener('change', () => { season = r.value; if (season === 'dec' && +lr.value > 16) { lr.value = 14.5; fill(lr); } setLight(); if (sel) fillUnit(byId(sel)); }));

/* ---------- unit card ---------- */
const card = $('[data-unit]');
function fillUnit(u) {
  const [sk, c] = ST[u.status];
  $('[data-u-status]').textContent = t(sk) + (u.status === 'reserved' ? t('may_free') : ''); $('[data-u-status]').style.setProperty('--c', c);
  $('[data-u-title]').textContent = u.id; $('[data-u-sub]').textContent = t('sub', { type: tl(u), v: u.vol });
  $('[data-u-area]').textContent = `${u.area} m²`; $('[data-u-terr]').textContent = u.terrace ? `${u.terrace} m² ${t(u.top ? 'terrace' : 'balcony')}` : '—';
  $('[data-u-floor]').textContent = t('floor_of', { f: u.floor + 1, n: ({ A: 8, B: 6, C: 4 })[u.vol] }); $('[data-u-or]').textContent = t(OR[u.orient] || 'or_sw');
  const sh = E ? E.sunHours(season) : 0; $('[data-u-sunh]').textContent = t('sunh', { h: Math.round(sh), m: t('m_' + season) });
  $('[data-u-ppm]').textContent = eur(u.ppm); $('[data-u-price]').textContent = u.status === 'sold' ? t('st_sold') : eur(u.price);
  $('[data-u-month]').textContent = u.status === 'sold' ? t('sold_note') : t('month_note', { m: eur(monthly(u.price, 20, 30, 3.75)) });
  $('[data-u-plan]').textContent = t('u_plan');
  const lay = $('[data-u-layout]'); if (lay) { lay.innerHTML = planSVG(u.type, { labels: false, dims: false }) + `<span class="mono">${t('u_layout')}</span>`; lay.dataset.type = u.type; }
}
function choose(u, fromList) {
  sel = u.id; fillUnit(u); card.hidden = false; E && (E.select(u.id), E.focusUnit(u));
  $$('[data-rows] [data-id]').forEach(b => b.setAttribute('aria-current', b.dataset.id === u.id));
  if (fromList) { const r = stage.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) stage.scrollIntoView({ behavior: 'smooth', block: TOUCH ? 'start' : 'center' }); }
  calcFor(u); vunit.value = u.id;
}
function unchoose() { sel = null; card.hidden = true; E && (E.select(null), E.focusUnit(null)); $$('[data-rows] [data-id]').forEach(b => b.setAttribute('aria-current', 'false')); }
$('[data-unit-close]').addEventListener('click', unchoose);
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('[data-studio]').classList.contains('open') && !card.hidden) unchoose(); });
$('[data-u-visit]').addEventListener('click', () => { if (TOUCH) card.hidden = true; $('#visit').scrollIntoView({ behavior: 'smooth' }); });

/* ---------- design studio ---------- */
// the studio (and its 3D interior engine) is only downloaded when someone opens it
let studioP = null;
const getStudio = () => studioP || (studioP = import('./studio.js?v=20261118c').then(m => (window.__studio = m.initStudio({ getEstate: boot, toast,
  onBook: () => setTimeout(() => $('#visit').scrollIntoView({ behavior: 'smooth' }), 80),
  onClose: () => { if (E) { E.mount(stage, 'building'); setLight(); } } }))));
$('[data-u-plan]').addEventListener('click', () => { const u = byId(sel); if (u) { if (TOUCH) card.hidden = true; getStudio().then(s => s.open(u, 'orbit')); } });
const sample = () => UNITS.find(u => u.type === 'T3' && u.status === 'free' && u.terrace) || UNITS.find(u => u.status === 'free');
$$('[data-open-studio]').forEach(b => b.addEventListener('click', () => getStudio().then(s => s.open(sel ? byId(sel) : sample(), b.dataset.openStudio || 'walk'))));
if (!TOUCH) $$('[data-open-studio], [data-u-plan]').forEach(b => b.addEventListener('pointerenter', getStudio, { once: true }));

/* ---------- inside ---------- */
const fin = $('.finish');
$('.finish__tabs').addEventListener('click', e => { const b = e.target.closest('[data-pal]'); if (!b) return; $$('[role=tab][data-pal]', fin).forEach(x => x.setAttribute('aria-selected', x === b)); fin.dataset.pal = b.dataset.pal; });

/* ---------- swipe dots ---------- */
function dots(track, key) {
  const box = $(`[data-dots-for="${key}"]`); if (!box || !track) return;
  const items = [...track.children]; box.innerHTML = items.map((_, i) => `<button type="button" aria-label="${i + 1}"></button>`).join('');
  const bs = [...box.children]; let cur = -1;
  const upd = () => { const w = items[0].offsetWidth + 10; const i = Math.min(items.length - 1, Math.round(track.scrollLeft / w)); if (i !== cur) { cur = i; bs.forEach((b, k) => b.setAttribute('aria-current', k === i)); } };
  track.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true }); upd();
  bs.forEach((b, i) => b.addEventListener('click', () => track.scrollTo({ left: items[i].offsetLeft - items[0].offsetLeft, behavior: 'smooth' })));
}
dots($('.gal'), 'gal'); dots($('.loc__pics'), 'loc');

/* ---------- lightbox ---------- */
const lb = $('[data-lb]'), lbT = $('[data-lb-track]'); const shots = $$('[data-gallery] li');
lbT.innerHTML = shots.map(li => { const im = li.querySelector('img'); return `<li><img data-src="${im.getAttribute('src').replace('-800', '-1600')}" alt="${im.alt}" decoding="async"></li>`; }).join('');
let lbI = -1; const lbSet = () => { const i = Math.round(lbT.scrollLeft / lbT.clientWidth); if (i === lbI) return; lbI = i; $('[data-lb-count]').textContent = `${i + 1} / ${shots.length}`; $('[data-lb-cap]').textContent = shots[i].querySelector('p').textContent; };
lbT.addEventListener('scroll', () => requestAnimationFrame(lbSet), { passive: true });
function lbOpen(i) { $$('img[data-src]', lbT).forEach(im => { im.src = im.dataset.src; im.removeAttribute('data-src'); }); lb.hidden = false; requestAnimationFrame(() => { lb.classList.add('open'); lbT.scrollLeft = i * lbT.clientWidth; lbI = -1; lbSet(); }); document.body.style.overflow = 'hidden'; }
function lbClose() { lb.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => { lb.hidden = true; }, 350); }
$('[data-gallery]').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) lbOpen(+b.dataset.open); });
$('[data-lb-close]').addEventListener('click', lbClose);
let sy = null, sx = 0; lbT.addEventListener('touchstart', e => { sy = e.touches[0].clientY; sx = e.touches[0].clientX; }, { passive: true });
lbT.addEventListener('touchend', e => { if (sy == null) return; const dy = e.changedTouches[0].clientY - sy, dx = e.changedTouches[0].clientX - sx; if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) lbClose(); sy = null; }, { passive: true });
addEventListener('keydown', e => { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') lbClose(); if (e.key === 'ArrowRight') lbT.scrollBy({ left: lbT.clientWidth, behavior: 'smooth' }); if (e.key === 'ArrowLeft') lbT.scrollBy({ left: -lbT.clientWidth, behavior: 'smooth' }); });

/* ---------- mortgage ---------- */
const C = { price: $('#c-price'), down: $('#c-down'), years: $('#c-years'), rate: $('#c-rate') };
function calc() {
  const Pp = +C.price.value, d = +C.down.value, y = +C.years.value, r = +C.rate.value;
  $('[data-o-price]').textContent = eur(Pp); $('[data-o-down]').textContent = `${d}% · ${eur(Pp * d / 100)}`; $('[data-o-years]').textContent = t('years', { n: y }); $('[data-o-rate]').textContent = `${r.toFixed(2)}%`;
  const m = monthly(Pp, d, y, r); $('[data-o-month]').textContent = eur(m);
  $('[data-o-note]').textContent = t('calc_note', { l: eur(Pp * (1 - d / 100)), i: eur(m * y * 12 - Pp * (1 - d / 100)), n: eur(m / .4) });
}
Object.values(C).forEach(i => i.addEventListener('input', calc)); calc();
function calcFor(u) { if (u.status === 'sold') return; C.price.value = u.price; fill(C.price); $('[data-calc-for]').textContent = t('calc_for', { id: u.id, type: tl(u) }); calc(); }

/* ---------- viewing form ---------- */
const vunit = $('[data-vunit]');
vunit.insertAdjacentHTML('beforeend', UNITS.filter(u => u.status !== 'sold').sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })).map(u => `<option value="${u.id}">${u.id} · ${tl(u)} · ${eur(u.price)}</option>`).join(''));
const vd = $('[data-vdays]'), vs = $('[data-vslots]'); let vDay = null, vSlot = null;
(() => { const now = new Date(); let html = '';
  for (let i = 1; i <= 10; i++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), wd = d.getDay(), wk = wd === 0 || wd === 6;
    html += `<button type="button" class="vday" data-d="${d.toDateString()}" data-wk="${wk ? 1 : 0}" aria-pressed="false"><small>${d.toLocaleDateString(DL, { weekday: 'short' })}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString(DL, { month: 'short' })}</small></button>`; }
  vd.innerHTML = html; })();
function vslots(b) {
  const wk = b.dataset.wk === '1', tt = wk ? ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00'] : ['10:00', '13:00', '17:30', '18:30'];
  let s = [...b.dataset.d].reduce((a, c) => a + c.charCodeAt(0), 0);
  vs.innerHTML = tt.map((x, i) => { s = (s * 31 + i) % 97; const taken = s % 4 === 0; return `<button type="button" class="vslot" data-t="${x}" ${taken ? 'disabled style="opacity:.35;text-decoration:line-through"' : ''} aria-pressed="false">${x}</button>`; }).join('') + (wk ? '' : `<p class="small muted" style="flex-basis:100%">${t('wk_note')}</p>`);
}
vd.addEventListener('click', e => { const b = e.target.closest('.vday'); if (!b) return; vDay = b.dataset.d; vSlot = null; $$('.vday', vd).forEach(x => x.setAttribute('aria-pressed', x === b)); vslots(b); });
vs.addEventListener('click', e => { const b = e.target.closest('.vslot'); if (!b || b.disabled) return; vSlot = b.dataset.t; $$('.vslot', vs).forEach(x => x.setAttribute('aria-pressed', x === b)); });
vd.querySelector('[data-wk="1"]')?.click();
const vf = $('[data-vform]');
vf.addEventListener('submit', e => {
  e.preventDefault(); let ok = true, first = null;
  for (const i of $$('input[required]', vf)) { const v = i.value.trim(); const bad = !v || (i.type === 'tel' && v.replace(/\D/g, '').length < 7); i.setAttribute('aria-invalid', bad); i.parentElement.querySelector('.err').hidden = !bad; if (bad) { ok = false; first = first || i; } }
  if (!vSlot) { $('[data-vstatus]').textContent = t('v_choose'); ok = false; }
  if (!ok) { first && first.focus(); return; }
  const d = new Date(vDay), unit = vunit.value;
  $('[data-vstatus]').textContent = t('v_booked', { d: d.toLocaleDateString(DL, { weekday: 'long', day: 'numeric', month: 'long' }), t: vSlot, u: unit ? t('v_showing', { id: unit }) : '' });
  toast(t('v_toast')); vf.querySelector('[data-vsubmit]').disabled = true; setTimeout(() => vf.querySelector('[data-vsubmit]').disabled = false, 3000);
});
vf.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid') === 'true') { e.target.setAttribute('aria-invalid', 'false'); e.target.parentElement.querySelector('.err').hidden = true; } });

/* ---------- sticky bar ---------- */
const bar = $('[data-bar]'); const vis = new Map(); let barOn = null;
const io2 = new IntersectionObserver(es => { es.forEach(e => vis.set(e.target, e.isIntersecting)); const on = ![...vis.values()].some(Boolean); if (on !== barOn) { barOn = on; bar.classList.toggle('on', on); } });
[$('.hero'), $('#apartments'), $('#visit')].forEach(el => io2.observe(el));

rows();

/* ---------- layouts ---------- */
const plBox = $('[data-plbox]');
function openPlan(type) { $('[data-plbox-in]').innerHTML = `<p class="mono">${t('type_' + type)} · ${TYPES[type].area} m²</p>` + planSVG(type); plBox.hidden = false; requestAnimationFrame(() => plBox.classList.add('on')); document.body.style.overflow = 'hidden'; $('[data-plbox-x]').focus(); }
function closePlan() { plBox.classList.remove('on'); document.body.style.overflow = ''; setTimeout(() => { plBox.hidden = true; }, 220); }
$('[data-plbox-x]').addEventListener('click', closePlan); plBox.addEventListener('click', e => { if (e.target === plBox) closePlan(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !plBox.hidden) closePlan(); });
$('[data-u-layout]')?.addEventListener('click', e => openPlan(e.currentTarget.dataset.type));
const PT = ['S1', 'T2', 'T3', 'P4']; let plType = 'T3';
const tabs = $('[data-pl-tabs]');
tabs.innerHTML = PT.map(k => `<button type="button" role="tab" data-pl="${k}" aria-selected="${k === plType}">${t('type_' + k)}</button>`).join('');
function renderPlan() {
  const T = TYPES[plType], P = PLANS[plType], { groups } = roomsOf(plType), fr = UNITS.filter(u => u.type === plType && u.status === 'free'), from = fr.length ? Math.min(...fr.map(u => u.price)) : 0;
  const outA = T.terrace || (plType === 'S1' ? 0 : plType === 'T3' ? 8.4 : 6.1);
  $('[data-pl-fig]').innerHTML = planSVG(plType) + `<span class="plans__zoom mono">${t('pl_zoom')}</span>`;
  $('[data-pl-info]').innerHTML = `<p class="plans__area"><b>${T.area}</b> m²<span>${t('pl_total')}${outA ? ` · +${outA} m² ${t(T.terrace ? 'pl_terrace' : 'pl_balcony').toLowerCase()}` : ''}</span></p>
    <p class="mono plans__t">${t('pl_net')}</p>
    <ul class="plans__rooms">${groups.map(g => `<li><span>${t('room_' + g.key)}</span><b>${(Math.round(g.net * 10) / 10).toFixed(1)} m²</b></li>`).join('')}</ul>
    <p class="small muted">${t('pl_dims', { w: P.W.toFixed(1), d: P.D.toFixed(1) })}</p>
    <p class="plans__free">${fr.length ? t('pl_free', { n: fr.length, p: eur(from) }) : t('pl_none')}</p>
    <div class="row"><button type="button" class="btn btn--sm" data-pl-show>${t('pl_show')}</button><button type="button" class="btn btn--sm btn--ghost" data-pl-walk>${t('pl_walk')}</button></div>`;
  $$('[data-pl]', tabs).forEach(b => b.setAttribute('aria-selected', b.dataset.pl === plType));
}
tabs.addEventListener('click', e => { const b = e.target.closest('[data-pl]'); if (!b) return; plType = b.dataset.pl; renderPlan(); });
$('[data-pl-fig]').addEventListener('click', () => openPlan(plType));
$('[data-pl-info]').addEventListener('click', e => {
  if (e.target.closest('[data-pl-show]')) { const n = TYPES[plType].rooms; F.rooms = new Set([n]); $$('[data-filters] [data-rooms]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.rooms === n)); F.onlyFree = true; $('[data-onlyfree]').checked = true; rows(); $('#apartments').scrollIntoView({ behavior: 'smooth' }); }
  if (e.target.closest('[data-pl-walk]')) { const u = UNITS.find(x => x.type === plType && x.status === 'free') || UNITS.find(x => x.type === plType); getStudio().then(s => s.open(u, 'walk')); }
});
renderPlan();
