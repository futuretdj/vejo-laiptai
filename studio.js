// Vėjo laiptai — design studio UI around interior.js
import { createInterior, OPTIONS, STYLES } from './interior.js';
import { t, eur } from './i18n.js';
import { TYPES } from './data.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TOUCH = document.documentElement.classList.contains('touch');
const TABS = ['style', 'walls', 'floor', 'kitchen', 'bath', 'light', 'furniture'];
const CAT2TAB = { sofa: 'furniture', bed: 'furniture', table: 'furniture', ctable: 'furniture', rug: 'furniture', side: 'furniture', desk: 'furniture', plant: 'furniture', kitchen: 'kitchen', island: 'kitchen', wardrobe: 'kitchen', bath: 'bath', shower: 'bath', wc: 'bath', sink: 'bath' };

export function initStudio({ getEstate, toast, onBook, onClose }) {
  const root = $('[data-studio]'), stage = $('[data-st-stage]'), body = $('[data-st-body]'), tabsEl = $('[data-st-tabs]'), panel = $('[data-st-panel]');
  const mini = $('[data-st-mini]'), joy = $('[data-st-joy]'), roomEl = $('[data-st-room]'), hint = $('[data-st-hint]'), load = $('[data-st-load]');
  $$('[data-t]', root).forEach(el => { el.textContent = t(el.dataset.t); });
  $$('[data-t-label]', root).forEach(el => el.setAttribute('aria-label', t(el.dataset.tLabel)));
  let I = null, E = null, tab = 'style', room = 0, summary = false, lastFocus = null, hintT = 0;
  const roomName = r => t('room_' + r.key);
  tabsEl.innerHTML = TABS.map(k => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${t('tab_' + k)}</button>`).join('');

  /* ---------- rendering the option panel ---------- */
  const sw = (k, v, on, extra = '') => `<button type="button" class="sw" data-k="${k}" data-v="${v}" aria-pressed="${on}" ${extra}><i style="--c:${OPTIONS[k][v]}"></i><span>${t(k + '_' + v)}</span></button>`;
  const grp = (title, inner, cls = '') => `<div class="stg ${cls}"><p class="stg__t mono">${title}</p><div class="sws">${inner}</div></div>`;
  const opts = (k, cur, extra) => Object.keys(OPTIONS[k]).map(v => sw(k, v, v === cur, extra)).join('');
  const chips = (list, cur) => `<div class="rchips">${list.map(r => `<button type="button" class="rchip" data-room="${r.i}" aria-pressed="${r.i === cur}">${roomName(r)}</button>`).join('')}</div>`;
  function render() {
    if (!I || !I.rooms.length) return; const D = I.D, rooms = I.rooms;
    $$('[data-tab]', tabsEl).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab && !summary));
    if (summary) return renderSummary();
    let h = '';
    if (tab === 'style') h = `<p class="stg__t mono">${t('g_style')}</p><div class="stcards">${Object.entries(STYLES).map(([k, s]) => `<button type="button" class="stc" data-k="style" data-v="${k}" aria-pressed="${D.style === k}"><span class="stc__dots">${['paint', 'floor', 'fronts', 'fabric'].map(x => `<i style="--c:${OPTIONS[x][s[x]]}"></i>`).join('')}</span><b>${t('style_' + k)}</b><small>${t('sd_' + k)}</small></button>`).join('')}</div>`;
    if (tab === 'walls') { const dry = rooms.filter(r => !r.wet); if (!dry.some(r => r.i === room)) room = dry[0].i;
      h = chips(dry, room) + grp(`${t('g_paint')} · ${roomName(rooms[room])}`, opts('paint', D.paint[room])) + `<button type="button" class="link" data-all="paint">${t('g_all')}</button>`; }
    if (tab === 'floor') h = grp(t('g_floor'), opts('floor', D.floor)) + grp(t('g_tile'), opts('tile', D.tile));
    if (tab === 'kitchen') h = grp(t('g_fronts'), opts('fronts', D.fronts)) + grp(t('g_worktop'), opts('worktop', D.worktop)) + grp(t('g_metal'), opts('metal', D.metal));
    if (tab === 'bath') h = (I.unit && hasBath() ? grp(t('g_wet'), opts('wet', D.wet)) : '') + grp(t('g_tile'), opts('tile', D.tile)) + grp(t('g_metal'), opts('metal', D.metal));
    if (tab === 'light') { const lr = rooms.filter(r => !r.wet && r.key !== 'hall'); if (!lr.some(r => r.i === room)) room = lr[0].i;
      h = `<div class="stg"><p class="stg__t mono">${t('g_time')}</p><div class="seg seg--sm"><button type="button" data-k="evening" data-v="0" aria-pressed="${!D.evening}">${t('st_day')}</button><button type="button" data-k="evening" data-v="1" aria-pressed="${D.evening}">${t('st_eve')}</button></div></div>`
        + chips(lr, room) + grp(`${t('g_light')} · ${roomName(rooms[room])}`, opts('light', D.light[room])) + `<button type="button" class="link" data-all="light">${t('g_all')}</button>`; }
    if (tab === 'furniture') h = `<label class="check stg"><input type="checkbox" data-furnish ${D.furnish ? 'checked' : ''}> ${t('g_furnish')}</label>`
      + grp(t('g_sofa'), opts('sofa', D.sofa)) + grp(t('g_fabric'), opts('fabric', D.fabric)) + grp(t('g_wood'), opts('wood', D.wood)) + grp(t('g_table'), opts('table', D.table)) + grp(t('g_rug'), opts('rug', D.rug));
    body.innerHTML = h; total();
  }
  const hasBath = () => I.unit && ['T2', 'T3', 'P4'].includes(I.unit.type);
  function total() { const p = I.price(); $('[data-st-total]').textContent = eur(p.total); $('[data-st-parts]').textContent = t('st_parts', { f: eur(p.finishes), m: eur(p.furniture) }); }
  function renderSummary() {
    const p = I.price(), D = I.D, rooms = I.rooms;
    const ch = [['tab_style', t('style_' + D.style)], ['g_floor', t('floor_' + D.floor)], ['g_tile', t('tile_' + D.tile)], ['g_fronts', t('fronts_' + D.fronts)], ['g_worktop', t('worktop_' + D.worktop)], ['g_metal', t('metal_' + D.metal)], ...(hasBath() ? [['g_wet', t('wet_' + D.wet)]] : []),
      ...rooms.filter(r => !r.wet).map(r => [null, `${roomName(r)}: ${t('paint_' + D.paint[r.i])}${r.key !== 'hall' ? ' · ' + t('light_' + D.light[r.i]) : ''}`]),
      ...(D.furnish ? [['g_sofa', t('sofa_' + D.sofa) + ', ' + t('fabric_' + D.fabric)], ['g_wood', t('wood_' + D.wood)], ['g_table', t('table_' + D.table)], ['g_rug', t('rug_' + D.rug)]] : [])];
    body.innerHTML = `<div class="sum2"><p class="stg__t mono">${t('st_choices')}</p><ul class="sum2__l">${ch.map(([k, v]) => `<li>${k ? `<span>${t(k)}</span>` : ''}<b>${v}</b></li>`).join('')}</ul>
      <p class="stg__t mono">${t('st_extras')}</p><ul class="sum2__p">${p.lines.map(([k, v]) => `<li><span>${t(k)}</span><b>${v ? '+' + eur(v) : t('st_inc')}</b></li>`).join('')}
      <li><span>${t('st_furn')}</span><b>${p.furniture ? eur(p.furniture) : '—'}</b></li><li class="tot"><span>${t('st_grand')}</span><b>${eur(p.total)}</b></li></ul>
      <div class="row"><button type="button" class="btn btn--sm" data-send>${t('st_send')}</button><button type="button" class="link" data-unsum>${t('st_back')}</button></div></div>`;
    total();
  }

  /* ---------- panel events ---------- */
  tabsEl.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; summary = false; panel.classList.remove('min'); render(); body.scrollTop = 0; });
  body.addEventListener('click', async e => {
    const r = e.target.closest('[data-room]'); if (r) { room = +r.dataset.room; render(); return; }
    if (e.target.closest('[data-unsum]')) { summary = false; render(); return; }
    if (e.target.closest('[data-send]')) { toast(t('st_sent')); return; }
    const a = e.target.closest('[data-all]'); if (a) { const k = a.dataset.all; await I.set(k, I.D[k][room], null); render(); return; }
    const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k, v = b.dataset.v;
    $$(`[data-k="${k}"]`, body).forEach(x => x.setAttribute('aria-pressed', x === b));
    if (k === 'evening') { await I.set('evening', v === '1'); syncTime(); }
    else if (k === 'paint' || k === 'light') await I.set(k, v, room);
    else await I.set(k, v);
    render();
  });
  body.addEventListener('change', e => { if (e.target.matches('[data-furnish]')) { I.set('furnish', e.target.checked); total(); } });
  $('[data-st-sum]').addEventListener('click', () => { summary = true; panel.classList.remove('min'); render(); body.scrollTop = 0; });
  $('[data-st-book]').addEventListener('click', () => { close(); onBook && onBook(); });
  $('[data-st-grab]').addEventListener('click', () => panel.classList.toggle('min'));
  $$('[name=stmode]').forEach(r => r.addEventListener('change', () => setMode(r.value)));
  $$('[name=sttime]').forEach(r => r.addEventListener('change', async () => { await I.set('evening', r.value === 'eve'); render(); }));
  const syncTime = () => { $(`[name=sttime][value="${I.D.evening ? 'eve' : 'day'}"]`).checked = true; };
  $('[data-st-close]').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('open')) close(); });

  function setMode(m) { I.setMode(m); $(`[name=stmode][value="${m}"]`).checked = true; root.dataset.mode = m;
    showHint(t(m === 'walk' ? (TOUCH ? 'hint_walk_touch' : 'hint_walk_mouse') : 'hint_orbit')); drawMini(); if (m === 'walk') roomEl.hidden = false; }
  function showHint(s) { hint.textContent = s; hint.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(() => hint.classList.remove('on'), 7000); }

  /* ---------- minimap ---------- */
  const mg = mini.getContext('2d'); let mm = null;
  function drawMini() {
    if (!I || !I.rooms.length) return; const dpr = Math.min(2, devicePixelRatio || 1), cw = mini.clientWidth, ch = mini.clientHeight; if (!cw) return;
    if (mini.width !== Math.round(cw * dpr)) { mini.width = Math.round(cw * dpr); mini.height = Math.round(ch * dpr); }
    const p = I.pose, s = Math.min((cw - 12) / p.W, (ch - 12) / p.D), ox = (cw - p.W * s) / 2, oy = (ch - p.D * s) / 2; mm = { s, ox, oy };
    mg.setTransform(dpr, 0, 0, dpr, 0, 0); mg.clearRect(0, 0, cw, ch);
    for (const r of I.rooms) { mg.fillStyle = r.i === p.room ? 'rgba(194,80,42,.85)' : r.wet ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.5)'; mg.fillRect(ox + r.x0 * s + 1, oy + r.z0 * s + 1, (r.x1 - r.x0) * s - 2, (r.z1 - r.z0) * s - 2); }
    mg.fillStyle = 'rgba(255,255,255,.9)'; mg.fillRect(ox, oy - 2, p.W * s, 2); // window wall
    if (I.mode === 'walk') { const x = ox + p.x * s, y = oy + p.z * s, a = -p.yaw - Math.PI / 2;
      mg.fillStyle = 'rgba(255,255,255,.35)'; mg.beginPath(); mg.moveTo(x, y); mg.arc(x, y, 26, a - .6, a + .6); mg.closePath(); mg.fill();
      mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(x, y, 4.5, 0, Math.PI * 2); mg.fill(); mg.strokeStyle = '#1c2220'; mg.lineWidth = 1.5; mg.stroke(); }
  }
  mini.addEventListener('click', e => { if (!mm) return; const r = mini.getBoundingClientRect(), x = (e.clientX - r.left - mm.ox) / mm.s, z = (e.clientY - r.top - mm.oy) / mm.s;
    const rm = I.rooms.find(q => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1); if (rm) { I.teleport(rm.i); $(`[name=stmode][value="walk"]`).checked = true; root.dataset.mode = 'walk'; } });

  /* ---------- joystick ---------- */
  let jid = null; const knob = joy.firstElementChild;
  const jmove = e => { const r = joy.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - r.left - R, dy = e.clientY - r.top - R; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; I.joy(dx / R, -dy / R, true); };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; I.joy(0, 0, false); };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);

  /* ---------- open / close ---------- */
  async function open(unit, mode = 'orbit') {
    lastFocus = document.activeElement; E = await getEstate();
    if (!I) { I = createInterior(E.renderer);
      I.onRoom = r => { roomEl.textContent = `${roomName(r)} · ${t('area', { a: r.area.toFixed(1) })}`; if (!r.wet && r.key !== 'hall' || tab === 'walls' && !r.wet) { room = r.i; if (tab === 'walls' || tab === 'light') render(); } };
      I.onSelect = s => { if (s.type === 'wall') { if (s.wet) tab = 'bath'; else { tab = 'walls'; room = s.room; } } else if (s.type === 'floor') tab = s.wet ? 'bath' : 'floor';
        else if (s.type === 'light') { tab = 'light'; const r = I.rooms[s.room]; if (r && !r.wet && r.key !== 'hall') room = s.room; } else if (s.type === 'item') { tab = CAT2TAB[s.cat] || 'furniture'; toast(t('sel_item', { n: t('it_' + s.cat) })); }
        summary = false; panel.classList.remove('min'); render(); };
      I.onFrame = drawMini; }
    root.hidden = false; requestAnimationFrame(() => root.classList.add('open')); document.body.style.overflow = 'hidden';
    load.classList.remove('off'); E.mount(null, 'ext'); I.mount(stage);
    $('[data-st-title]').textContent = unit.id; $('[data-st-sub]').textContent = `${t('type_' + unit.type)} · ${unit.area} m²`;
    if (I.loaded !== unit) await I.load(unit);
    if (TOUCH && innerWidth < 1024) panel.classList.add('min');
    tab = 'style'; summary = false; room = I.rooms.find(r => !r.wet && r.key !== 'hall')?.i ?? 0; render(); syncTime();
    if (mode === 'walk') I.teleport(room); setMode(mode);
    roomEl.textContent = ''; load.classList.add('off'); $('[data-st-close]').focus({ preventScroll: true });
  }
  function close() {
    if (!root.classList.contains('open')) return; I && I.unmount(); root.classList.remove('open'); document.body.style.overflow = '';
    setTimeout(() => { root.hidden = true; }, 300); onClose && onClose(); lastFocus && lastFocus.focus?.({ preventScroll: true });
  }
  return { open, close, get engine() { return I; } };
}
