// Vėjo laiptai — page logic
import { UNITS, TYPES, PLANS, byId } from './data.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const eur = n => '€' + Math.round(n).toLocaleString('en-US');
const TOUCH = document.documentElement.classList.contains('touch');
const ST = { free: ['Free', '#4f8a63'], reserved: ['Reserved', '#d29a3a'], sold: ['Sold', '#a29d97'] };
let tT; const toast = m => { const t = $('[data-toast]'); t.textContent = m; t.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('on'), 2600); };
const hm = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const monthly = (P, down, yrs, rate) => { const L = P * (1 - down / 100), r = rate / 100 / 12, n = yrs * 12; return r ? L * r / (1 - (1 + r) ** -n) : L / n; };

/* ---------- nav ---------- */
const nav = $('[data-nav]'), mb = $('[data-menu]');
mb.addEventListener('click', () => { const o = !nav.classList.contains('open'); nav.classList.toggle('open', o); mb.setAttribute('aria-expanded', o); mb.textContent = o ? 'Close' : 'Menu'; });
$$('[data-sheet] a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); mb.setAttribute('aria-expanded', false); mb.textContent = 'Menu'; }));
let scs = null; const onS = () => { const s = scrollY > innerHeight * .75 - 70; if (s !== scs) { scs = s; nav.classList.toggle('sc', s); } };
addEventListener('scroll', onS, { passive: true }); onS();

/* ---------- facts ---------- */
const free = UNITS.filter(u => u.status === 'free');
$('[data-count-free]').textContent = `${free.length} free of ${UNITS.length}`;
$('[data-from]').textContent = eur(Math.min(...free.map(u => u.price)));
$('[data-bar-t]').textContent = `${free.length} free · from ${eur(Math.min(...free.map(u => u.price)))}`;

/* ---------- range fill ---------- */
const fill = r => r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
$$('input[type=range]').forEach(r => { fill(r); r.addEventListener('input', () => fill(r)); });

/* ---------- list + filters ---------- */
const F = { rooms: new Set(), max: 560000, onlyFree: true };
let sel = null;
const match = u => (!F.rooms.size || F.rooms.has(u.rooms)) && u.price <= F.max && (!F.onlyFree || u.status === 'free');
function rows() {
  const list = UNITS.filter(match).sort((a, b) => a.price - b.price);
  $('[data-count]').textContent = `${list.length} apartment${list.length === 1 ? '' : 's'} match`;
  $('[data-rows]').innerHTML = list.length ? list.map(u => `<button class="tr" role="row" type="button" data-id="${u.id}" aria-current="${sel === u.id}"><span><span class="st" style="--c:${ST[u.status][1]}"></span><b>${u.id}</b></span><span>${u.rooms}${u.top ? ' · PH' : ''}</span><span>${u.area}</span><span>${u.floor + 1}</span><span class="pr">${u.status === 'sold' ? 'Sold' : eur(u.price)}</span></button>`).join('') : '<p class="empty">Nothing matches. Try another room count or a higher price.</p>';
  E && E.filter(match);
}
$('[data-filters]').addEventListener('click', e => { const b = e.target.closest('[data-rooms]'); if (!b) return; const n = +b.dataset.rooms; F.rooms.has(n) ? F.rooms.delete(n) : F.rooms.add(n); b.setAttribute('aria-pressed', F.rooms.has(n)); rows(); });
const mp = $('[data-maxp]'); mp.addEventListener('input', () => { F.max = +mp.value; $('[data-maxp-out]').textContent = F.max >= 560000 ? 'any price' : eur(F.max); rows(); });
$('[data-onlyfree]').addEventListener('change', e => { F.onlyFree = e.target.checked; rows(); });
$('[data-rows]').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; choose(byId(b.dataset.id), true); });

/* ---------- 3D ---------- */
let E = null; const stage = $('[data-stage]');
async function boot() {
  const { createEstate } = await import('./estate3d.js');
  E = createEstate(); E.mount(stage, 'building'); E.overlays(true); E.filter(match);
  E.onPick = u => choose(u, false);
  if (!TOUCH) E.onHover = (u, ev) => { const tip = $('[data-tip]'); if (!u) { tip.hidden = true; return; } const r = stage.getBoundingClientRect(); tip.hidden = false; tip.textContent = `${u.id} · ${TYPES[u.type].label} · ${u.status === 'sold' ? 'sold' : eur(u.price)}`; tip.style.left = (ev.clientX - r.left) + 'px'; tip.style.top = (ev.clientY - r.top - 8) + 'px'; };
  setLight(); requestAnimationFrame(() => $('[data-stage-load]').classList.add('off'));
  window.__E = E;
}
// load 3D when the selector is near
let booted = false; const boot1 = () => { if (booted) return; booted = true; bio.disconnect(); boot(); };
const bio = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) boot1(); }, { rootMargin: '600px' }); bio.observe(stage);
// build the model while the visitor is still reading the first screen
addEventListener('load', () => (window.requestIdleCallback || (f => setTimeout(f, 600)))(boot1, { timeout: 1500 }), { once: true });

/* ---------- light ---------- */
const lr = $('[data-light-range]'); let season = 'jun';
function setLight() {
  const h = +lr.value; $('[data-light-time]').textContent = hm(h);
  if (!E) return; const s = E.setSun(h, season);
  $('[data-light-sun]').textContent = s.el <= 0 ? '· after sunset' : s.el < 8 ? '· low sun' : `· sun ${Math.round(s.el)}° high`;
}
let lraf = 0; lr.addEventListener('input', () => { cancelAnimationFrame(lraf); lraf = requestAnimationFrame(setLight); });
$$('[name=season]').forEach(r => r.addEventListener('change', () => { season = r.value; if (season === 'dec' && +lr.value > 16) { lr.value = 14.5; fill(lr); } setLight(); if (sel) fillUnit(byId(sel)); }));

/* ---------- unit card ---------- */
const card = $('[data-unit]');
function fillUnit(u) {
  const T = TYPES[u.type]; const [sl, c] = ST[u.status];
  $('[data-u-status]').textContent = sl + (u.status === 'reserved' ? ' · may free up' : ''); $('[data-u-status]').style.setProperty('--c', c);
  $('[data-u-title]').textContent = u.id; $('[data-u-sub]').textContent = `${T.label}, block ${u.vol}`;
  $('[data-u-area]').textContent = `${u.area} m²`; $('[data-u-terr]').textContent = u.terrace ? `${u.terrace} m² ${u.top ? 'terrace' : 'balcony'}` : '—';
  $('[data-u-floor]').textContent = `${u.floor + 1} of ${({ A: 8, B: 6, C: 4 })[u.vol]}`; $('[data-u-or]').textContent = u.orient;
  const sh = E ? E.sunHours(season) : 0; $('[data-u-sunh]').textContent = `≈${Math.round(sh)} h in ${({ jun: 'June', mar: 'March', dec: 'Dec' })[season]}`;
  $('[data-u-ppm]').textContent = eur(u.ppm);
  $('[data-u-price]').textContent = u.status === 'sold' ? 'Sold' : eur(u.price);
  $('[data-u-month]').textContent = u.status === 'sold' ? 'Ask about similar flats on other floors.' : `≈ ${eur(monthly(u.price, 20, 30, 3.75))}/month with 20% down over 30 years`;
  $('[data-u-plan]').textContent = 'See it in 3D';
}
function choose(u, fromList) {
  sel = u.id; fillUnit(u); card.hidden = false; E && (E.select(u.id), E.focusUnit(u));
  $$('[data-rows] [data-id]').forEach(b => b.setAttribute('aria-current', b.dataset.id === u.id));
  if (fromList) { const r = stage.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) stage.scrollIntoView({ behavior: 'smooth', block: TOUCH ? 'start' : 'center' }); }
  calcFor(u); vunit.value = u.id;
}
function unchoose() { sel = null; card.hidden = true; E && (E.select(null), E.focusUnit(null)); $$('[data-rows] [data-id]').forEach(b => b.setAttribute('aria-current', 'false')); }
$('[data-unit-close]').addEventListener('click', unchoose);
addEventListener('keydown', e => { if (e.key === 'Escape') { if (plan.classList.contains('open')) closePlan(); else if (!card.hidden) unchoose(); } });
$('[data-u-visit]').addEventListener('click', () => { if (TOUCH) card.hidden = true; $('#visit').scrollIntoView({ behavior: 'smooth' }); });

/* ---------- 3D plan ---------- */
const plan = $('[data-plan]'), pst = $('[data-plan-stage]'), plabs = $('[data-plan-labels]');
let labs = [], lastFocus = null;
function openPlan() {
  const u = byId(sel); if (!u || !E) return; lastFocus = document.activeElement;
  const l = E.buildPlan(u.type, { terrace: u.terrace, furniture: $('[data-pl-furn]').checked });
  $('[data-pl-title]').textContent = u.id; $('[data-pl-sub]').textContent = `${TYPES[u.type].label} · floor ${u.floor + 1} · block ${u.vol}`;
  const total = l.filter(x => !/Terrace|Balcony/.test(x.name)).reduce((a, x) => a + +x.area, 0);
  $('[data-pl-rooms]').innerHTML = l.map(x => `<li><span>${x.name}</span><span>${x.area} m²</span></li>`).join('') + `<li><span>Total indoor</span><span>${u.area} m²</span></li>`;
  $('[data-pl-price]').textContent = u.status === 'sold' ? 'Sold' : eur(u.price);
  plabs.innerHTML = l.map(x => `<span class="plabel">${x.name}<b>${x.area}</b></span>`).join(''); labs = l.map((x, i) => ({ ...x, el: plabs.children[i] }));
  plan.hidden = false; requestAnimationFrame(() => plan.classList.add('open'));
  document.body.style.overflow = 'hidden';
  E.mount(pst, 'plan'); pst.dataset.spin = TOUCH ? '' : '1'; if (TOUCH) delete pst.dataset.spin;
  E.onFrame = placeLabels; $('[data-plan-close]').focus({ preventScroll: true });
  $('[name=pv][value="3d"]').checked = true;
}
function placeLabels() {
  if (E.mode !== 'plan') return; const r = pst.getBoundingClientRect();
  for (const l of labs) { const p = E.project(l.pos); const x = Math.max(40, Math.min(r.width - 40, p.x)), y = Math.max(14, Math.min(r.height - 14, p.y)); l.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; }
}
function closePlan() {
  plan.classList.remove('open'); document.body.style.overflow = ''; E.onFrame = null;
  setTimeout(() => { plan.hidden = true; }, 350); E.mount(stage, 'building'); lastFocus && lastFocus.focus({ preventScroll: true });
}
$('[data-u-plan]').addEventListener('click', openPlan);
$('[data-plan-close]').addEventListener('click', closePlan);
$('[data-pl-furn]').addEventListener('change', e => E.furniture(e.target.checked));
$$('[name=pv]').forEach(r => r.addEventListener('change', () => E.view(r.value)));
$('[data-pl-visit]').addEventListener('click', () => { closePlan(); card.hidden = TOUCH ? true : card.hidden; setTimeout(() => $('#visit').scrollIntoView({ behavior: 'smooth' }), 60); });
$('[data-pl-pdf]').addEventListener('click', () => toast('Concept site: the real one would download a PDF plan here.'));

/* ---------- inside ---------- */
const SPEC = [['Ceilings', '2.85 m, 3.2 m in penthouses'], ['Floors', 'Engineered oak, 14 mm'], ['Heating', 'Heat pump + underfloor'], ['Air', 'Heat-recovery ventilation'], ['Windows', 'Triple glazed, timber-aluminium'], ['Sound', 'Floating screed, 55 dB walls'], ['Lifts', 'Two per block, to the car park'], ['Energy', 'Class A++, solar on roofs']];
$('[data-spec]').innerHTML = SPEC.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
const fin = $('.finish');
$('.finish__tabs').addEventListener('click', e => { const b = e.target.closest('[data-pal]'); if (!b) return; $$('[data-pal]', fin).forEach(x => x.getAttribute('role') === 'tab' && x.setAttribute('aria-selected', x === b)); fin.dataset.pal = b.dataset.pal; });

/* ---------- swipe dots ---------- */
function dots(track, key) {
  const box = $(`[data-dots-for="${key}"]`); if (!box || !track) return;
  const items = [...track.children]; box.innerHTML = items.map((_, i) => `<button type="button" aria-label="Go to ${i + 1}"></button>`).join('');
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
  const P = +C.price.value, d = +C.down.value, y = +C.years.value, r = +C.rate.value;
  $('[data-o-price]').textContent = eur(P); $('[data-o-down]').textContent = `${d}% · ${eur(P * d / 100)}`; $('[data-o-years]').textContent = `${y} years`; $('[data-o-rate]').textContent = `${r.toFixed(2)}%`;
  const m = monthly(P, d, y, r); $('[data-o-month]').textContent = eur(m);
  $('[data-o-note]').textContent = `Loan ${eur(P * (1 - d / 100))}, about ${eur(m * y * 12 - P * (1 - d / 100))} interest in total. Banks usually want the payment under 40% of your net income: about ${eur(m / .4)} a month.`;
}
Object.values(C).forEach(i => i.addEventListener('input', calc)); calc();
function calcFor(u) { if (u.status === 'sold') return; C.price.value = u.price; fill(C.price); $('[data-calc-for]').textContent = `For apartment ${u.id}, ${TYPES[u.type].label}`; calc(); }

/* ---------- viewing form ---------- */
const vunit = $('[data-vunit]');
vunit.insertAdjacentHTML('beforeend', UNITS.filter(u => u.status !== 'sold').sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })).map(u => `<option value="${u.id}">${u.id} · ${TYPES[u.type].label} · ${eur(u.price)}</option>`).join(''));
const vd = $('[data-vdays]'), vs = $('[data-vslots]'); let vDay = null, vSlot = null;
(() => {
  const now = new Date(); let html = '', n = 0;
  for (let i = 1; n < 10 && i < 30; i++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i); const wd = d.getDay(); const wk = wd === 0 || wd === 6;
    html += `<button type="button" class="vday" data-d="${d.toDateString()}" data-wk="${wk ? 1 : 0}" aria-pressed="false"><small>${d.toLocaleDateString('en-GB', { weekday: 'short' })}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString('en-GB', { month: 'short' })}</small></button>`; n++; }
  vd.innerHTML = html;
})();
function vslots(b) {
  const wk = b.dataset.wk === '1'; const t = wk ? ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00'] : ['10:00', '13:00', '17:30', '18:30'];
  let s = [...b.dataset.d].reduce((a, c) => a + c.charCodeAt(0), 0); vs.innerHTML = t.map((x, i) => { s = (s * 31 + i) % 97; const taken = s % 4 === 0; return `<button type="button" class="vslot" data-t="${x}" ${taken ? 'disabled style="opacity:.35;text-decoration:line-through"' : ''} aria-pressed="false">${x}</button>`; }).join('') + (wk ? '' : '<p class="small muted" style="flex-basis:100%">Weekdays by appointment, a sales manager meets you at the pavilion.</p>');
}
vd.addEventListener('click', e => { const b = e.target.closest('.vday'); if (!b) return; vDay = b.dataset.d; vSlot = null; $$('.vday', vd).forEach(x => x.setAttribute('aria-pressed', x === b)); vslots(b); });
vs.addEventListener('click', e => { const b = e.target.closest('.vslot'); if (!b || b.disabled) return; vSlot = b.dataset.t; $$('.vslot', vs).forEach(x => x.setAttribute('aria-pressed', x === b)); });
vd.querySelector('[data-wk="1"]')?.click();
const vf = $('[data-vform]');
vf.addEventListener('submit', e => {
  e.preventDefault(); let ok = true, first = null;
  for (const i of $$('input[required]', vf)) { const v = i.value.trim(); const bad = !v || (i.type === 'tel' && v.replace(/\D/g, '').length < 7); i.setAttribute('aria-invalid', bad); i.parentElement.querySelector('.err').hidden = !bad; if (bad) { ok = false; first = first || i; } }
  if (!vSlot) { $('[data-vstatus]').textContent = 'Choose a day and a time above.'; ok = false; }
  if (!ok) { first && first.focus(); return; }
  const d = new Date(vDay); const unit = vunit.value;
  $('[data-vstatus]').textContent = `Booked: ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${vSlot}${unit ? `, showing ${unit}` : ''}. Concept site: nothing was sent.`;
  toast('Viewing booked'); vf.querySelector('[data-vsubmit]').disabled = true; setTimeout(() => vf.querySelector('[data-vsubmit]').disabled = false, 3000);
});
vf.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid') === 'true') { e.target.setAttribute('aria-invalid', 'false'); e.target.parentElement.querySelector('.err').hidden = true; } });

/* ---------- sticky bar ---------- */
const bar = $('[data-bar]'); const vis = new Map(); let barOn = null;
const io2 = new IntersectionObserver(es => { es.forEach(e => vis.set(e.target, e.isIntersecting)); const on = ![...vis.values()].some(Boolean); if (on !== barOn) { barOn = on; bar.classList.toggle('on', on); } });
[$('.hero'), $('#apartments'), $('#visit')].forEach(el => io2.observe(el));

rows();
