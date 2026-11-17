// Vėjo laiptai — measured 2D floor plans drawn from the same data as the 3D interiors
import { PLANS, TYPES } from './data.js';
import { t } from './i18n.js';

const KEY = { 'Living & sleeping': 'living_sleep', 'Living & kitchen': 'living_kitchen', 'Living & dining': 'living_dining', Kitchen: 'kitchen', Bathroom: 'bath', Hall: 'hall', Bedroom: 'bedroom', 'Main bedroom': 'main_bedroom', WC: 'wc', Study: 'study' };
const S = 46, TI = .1, TE = .24; // px per metre, wall thicknesses
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);

export function roomsOf(type) {
  const P = PLANS[type], rooms = P.rooms.map(([name, x0, z0, x1, z1]) => ({ name, key: KEY[name] || 'hall', x0, z0, x1, z1 }));
  // net area: subtract half of each interior wall, and the outer walls lie outside the drawing
  for (const r of rooms) { const w = (r.x1 - r.x0) - (r.x0 > 0 ? TI / 2 : 0) - (r.x1 < P.W ? TI / 2 : 0), d = (r.z1 - r.z0) - (r.z0 > 0 ? TI / 2 : 0) - (r.z1 < P.D ? TI / 2 : 0); r.net = w * d; r.w = w; r.d = d; }
  // pieces of the same hall that touch are one room
  const groups = [];
  for (const r of rooms) {
    const touch = g => g.key === r.key && r.key === 'hall' && g.parts.some(p => p.x0 <= r.x1 + .01 && r.x0 <= p.x1 + .01 && p.z0 <= r.z1 + .01 && r.z0 <= p.z1 + .01);
    const g = groups.find(touch); if (g) { g.parts.push(r); g.net += r.net; } else groups.push({ key: r.key, name: r.name, parts: [r], net: r.net });
  }
  for (const g of groups) { g.main = g.parts.reduce((a, b) => b.net > a.net ? b : a); }
  return { P, rooms, groups };
}

function outdoor(type) { const T = TYPES[type]; if (T.terrace) return { area: T.terrace, depth: Math.min(5, T.terrace / PLANS[type].W), kind: 'terrace' }; return { area: type === 'T3' ? 8.4 : 6.1, depth: 1.25, kind: 'balcony' }; }

export function planSVG(type, { labels = true, dims = true, furniture = true, balcony = true, cls = '' } = {}) {
  const { P, rooms, groups } = roomsOf(type), W = P.W, D = P.D, out = balcony && type !== 'S1' ? outdoor(type) : null;
  const pad = dims ? 34 : 8, bot = out ? out.depth : 0;
  const X = x => pad + x * S, Y = z => pad + (D - z) * S; // windows (z = 0) at the bottom, corridor at the top
  const vw = W * S + pad * 2, vh = (D + bot) * S + pad * 2 + (dims ? 0 : 0);
  const o = [];
  const rect = (x0, z0, x1, z1, c = '', extra = '') => `<rect x="${X(Math.min(x0, x1)).toFixed(1)}" y="${Y(Math.max(z0, z1)).toFixed(1)}" width="${(Math.abs(x1 - x0) * S).toFixed(1)}" height="${(Math.abs(z1 - z0) * S).toFixed(1)}" class="${c}" ${extra}/>`;
  // terrace / balcony
  if (out) { o.push(rect(0, -out.depth, W, -TE / 2, 'p-out')); o.push(`<line x1="${X(0)}" y1="${Y(-out.depth)}" x2="${X(W)}" y2="${Y(-out.depth)}" class="p-rail"/>`); }
  // walls: one dark slab, rooms cut out of it
  o.push(rect(-TE / 2, -TE / 2, W + TE / 2, D + TE / 2, 'p-wall'));
  for (const r of rooms) o.push(rect(r.x0 + (r.x0 > 0 ? TI / 2 : 0), r.z0 + (r.z0 > 0 ? TI / 2 : 0), r.x1 - (r.x1 < W ? TI / 2 : 0), r.z1 - (r.z1 < D ? TI / 2 : 0), r.key === 'bath' || r.key === 'wc' ? 'p-wet' : 'p-room'));
  // halls made of several pieces: remove the walls between the pieces
  for (const g of groups) for (const a of g.parts) for (const b of g.parts) if (a !== b) {
    if (Math.abs(a.z1 - b.z0) < .01) { const x0 = Math.max(a.x0, b.x0) + TI / 2, x1 = Math.min(a.x1, b.x1) - TI / 2; if (x1 > x0) o.push(rect(x0, a.z1 - TI, x1, a.z1 + TI, 'p-room')); }
    if (Math.abs(a.x1 - b.x0) < .01) { const z0 = Math.max(a.z0, b.z0) + TI / 2, z1 = Math.min(a.z1, b.z1) - TI / 2; if (z1 > z0) o.push(rect(a.x1 - TI, z0, a.x1 + TI, z1, 'p-room')); }
  }
  const roomAt = (x, z) => rooms.find(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  // windows along the facade
  for (const r of rooms) if (r.z0 < .01 && r.key !== 'wc') { const glass = r.key.startsWith('living'), a = r.x0 + (glass ? .25 : .45), b = r.x1 - (glass ? .25 : .45); if (b - a < .4) continue;
    o.push(rect(a, -TE / 2, b, TE / 2, 'p-win')); o.push(`<line x1="${X(a)}" y1="${Y(0)}" x2="${X(b)}" y2="${Y(0)}" class="p-glass"/>`); }
  // openings and doors
  const swings = [];
  for (const [x0, z0, x1, z1] of P.open) {
    const h = Math.abs(z0 - z1) < .01, a = h ? Math.min(x0, x1) : Math.min(z0, z1), b = h ? Math.max(x0, x1) : Math.max(z0, z1), c = h ? z0 : x0, L = b - a; if (L < .3) continue;
    const ext = h ? (c < .01 || c > D - .01) : (c < .01 || c > W - .01), th = (ext ? TE : TI) / 2 + .01;
    o.push(h ? rect(a, c - th, b, c + th, 'p-room') : rect(c - th, a, c + th, b, 'p-room'));
    const entry = h && c > D - .01; if (L > 1.15 && !entry) continue; // wide openings have no leaf
    const side = s => h ? roomAt((a + b) / 2, c + s * .3) : roomAt(c + s * .3, (a + b) / 2);
    let s = entry ? -1 : 1; if (!entry) { const r1 = side(1), r0 = side(-1); if (!r1) s = -1; else if (r0) s = (r1.key === 'hall' && r0.key !== 'hall') ? -1 : (r0.key === 'hall' && r1.key !== 'hall') ? 1 : ((r1.x1 - r1.x0) * (r1.z1 - r1.z0) <= (r0.x1 - r0.x0) * (r0.z1 - r0.z0) ? 1 : -1); }
    const lw = L - .06, hx = a + .03; // hinge at the low end
    const P0 = h ? [hx, c] : [c, hx], P1 = h ? [hx, c + s * lw] : [c + s * lw, hx], P2 = h ? [hx + lw, c] : [c, hx + lw];
    const sweep = (h ? (s > 0 ? 1 : 0) : (s > 0 ? 0 : 1)); swings.push([Math.min(P0[0], P1[0], P2[0]), Math.min(P0[1], P1[1], P2[1]), Math.max(P0[0], P1[0], P2[0]), Math.max(P0[1], P1[1], P2[1])]);
    o.push(`<path d="M${X(P1[0]).toFixed(1)} ${Y(P1[1]).toFixed(1)} A${(lw * S).toFixed(1)} ${(lw * S).toFixed(1)} 0 0 ${sweep} ${X(P2[0]).toFixed(1)} ${Y(P2[1]).toFixed(1)}" class="p-arc"/>`);
    o.push(`<line x1="${X(P0[0]).toFixed(1)}" y1="${Y(P0[1]).toFixed(1)}" x2="${X(P1[0]).toFixed(1)}" y2="${Y(P1[1]).toFixed(1)}" class="${entry ? 'p-leaf p-entry' : 'p-leaf'}"/>`);
  }
  // furniture
  if (furniture) {
    const F = [], g = (s) => F.push(s);
    const backOf = (x, z, w, d) => { const r = roomAt(x + w / 2, z + d / 2); if (!r) return 'z1'; const ds = { x0: x - r.x0, x1: r.x1 - (x + w), z0: z - r.z0, z1: r.z1 - (z + d) }; return Object.entries(ds).sort((p, q) => p[1] - q[1])[0][0]; };
    const strip = (x, z, w, d, side, t) => side === 'x0' ? [x, z, x + t, z + d] : side === 'x1' ? [x + w - t, z, x + w, z + d] : side === 'z0' ? [x, z, x + w, z + t] : [x, z + d - t, x + w, z + d];
    const R = (x0, z0, x1, z1, c = 'p-f', rx = 2) => g(rect(x0, z0, x1, z1, c, `rx="${rx}"`));
    const circ = (x, z, r, c = 'p-f') => g(`<circle cx="${X(x).toFixed(1)}" cy="${Y(z).toFixed(1)}" r="${(r * S).toFixed(1)}" class="${c}"/>`);
    const ell = (x, z, rx, rz, c = 'p-f') => g(`<ellipse cx="${X(x).toFixed(1)}" cy="${Y(z).toFixed(1)}" rx="${(rx * S).toFixed(1)}" ry="${(rz * S).toFixed(1)}" class="${c}"/>`);
    const ln = (x0, z0, x1, z1, c = 'p-fl') => g(`<line x1="${X(x0).toFixed(1)}" y1="${Y(z0).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Y(z1).toFixed(1)}" class="${c}"/>`);
    let firstRun = true;
    const run = (x, z, w, d) => { R(x, z, x + w, z + d, 'p-f p-kit', 0); const along = w >= d, side = backOf(x, z, w, d);
      const fr = strip(x, z, w, d, side === 'x0' ? 'x1' : side === 'x1' ? 'x0' : side === 'z0' ? 'z1' : 'z0', .03); ln(fr[0], fr[1], fr[2], fr[3], 'p-fl');
      if (firstRun) { firstRun = false; const L = along ? w : d; const at = k => along ? [x + w * k, z + d / 2] : [x + w / 2, z + d * k];
        const [hx, hz] = at(.3); for (const [a, b] of [[-.1, -.1], [.1, -.1], [-.1, .1], [.1, .1]]) circ(hx + a, hz + b, .065, 'p-fl');
        if (L > 1.6) { const [sx, sz] = at(.68); R(sx - (along ? .25 : .2), sz - (along ? .2 : .25), sx + (along ? .25 : .2), sz + (along ? .2 : .25), 'p-f', 4); circ(sx, sz, .02, 'p-fl'); } } };
    for (const fz of P.furn) {
      const [kind, x, z, w = .5, d = .5, , n = 4] = fz, side = backOf(x, z, w, d), cx = x + w / 2, cz = z + d / 2, along = side === 'z0' || side === 'z1';
      if (kind === 'plant') { circ(x, z, .2, 'p-f p-plant'); circ(x - .06, z + .04, .07, 'p-fl'); circ(x + .07, z - .03, .06, 'p-fl'); continue; }
      if (kind === 'rug') { R(x, z, x + w, z + d, 'p-rug', 0); continue; }
      if (kind === 'kitchen-l') { run(x, z + d - .62, w, .62); if (d > 1) run(x, z, .62, d - .62); continue; }
      if (kind === 'kitchen') { run(x, z, w, d); continue; }
      if (kind === 'island') { R(x, z, x + w, z + d, 'p-f p-kit', 0); continue; }
      if (kind === 'bed') { R(x, z, x + w, z + d, 'p-f', 3); const hb = strip(x, z, w, d, side, .06); R(...hb, 'p-f p-dark', 1);
        const pw = (along ? w : d), n2 = pw > 1.2 ? 2 : 1;
        for (let k = 0; k < n2; k++) { const a = (k + .5) / n2, len = pw / n2 - .12; const p = strip(x, z, w, d, side, .44); const q = along ? [x + w * a - len / 2, p[1], x + w * a + len / 2, p[3]] : [p[0], z + d * a - len / 2, p[2], z + d * a + len / 2];
          const inset = along ? [q[0], side === 'z1' ? q[1] + .12 : q[1] + .06, q[2], side === 'z1' ? q[3] - .06 : q[3] - .12] : [side === 'x1' ? q[0] + .12 : q[0] + .06, q[1], side === 'x1' ? q[2] - .06 : q[2] - .12, q[3]]; R(...inset, 'p-f', 4); }
        const fold = strip(x, z, w, d, side, (along ? d : w) * .62); ln(...(side === 'z1' ? [x, fold[1], x + w, fold[1]] : side === 'z0' ? [x, fold[3], x + w, fold[3]] : side === 'x1' ? [fold[0], z, fold[0], z + d] : [fold[2], z, fold[2], z + d]));
        continue; }
      if (kind === 'sofa') { R(x, z, x + w, z + d, 'p-f', 4); R(...strip(x, z, w, d, side, .2), 'p-f p-dark', 3);
        const L = along ? w : d, ends = along ? [[x, z, x + .16, z + d], [x + w - .16, z, x + w, z + d]] : [[x, z, x + w, z + .16], [x, z + d - .16, x + w, z + d]]; ends.forEach(e => R(...e, 'p-f p-dark', 3));
        const nS = L > 2.1 ? 3 : 2; for (let k = 1; k < nS; k++) { const a = .16 + (L - .32) * k / nS; if (along) ln(x + a, z + .2, x + a, z + d - .2); else ln(x + .2, z + a, x + w - .2, z + a); }
        continue; }
      if (kind === 'ctable') { R(x, z, x + w, z + d, 'p-f', 6); continue; }
      if (kind === 'side') { R(x, z, x + w, z + d, 'p-f', 2); circ(cx, cz, .08, 'p-fl'); continue; }
      if (kind === 'table') { const ch = .42; const nn = Math.max(2, n), per = Math.ceil(nn / 2), lng = w >= d;
        for (let k = 0; k < per; k++) { const a = (k + .5) / per;
          if (lng) { R(x + w * a - ch / 2, z - .3, x + w * a + ch / 2, z + .08, 'p-f', 4); if (k < nn - per) R(x + w * a - ch / 2, z + d - .08, x + w * a + ch / 2, z + d + .3, 'p-f', 4); }
          else { R(x - .3, z + d * a - ch / 2, x + .08, z + d * a + ch / 2, 'p-f', 4); if (k < nn - per) R(x + w - .08, z + d * a - ch / 2, x + w + .3, z + d * a + ch / 2, 'p-f', 4); } }
        R(x, z, x + w, z + d, 'p-f p-top', 2); continue; }
      if (kind === 'desk') { R(x, z, x + w, z + d, 'p-f p-top', 1); const fr = side === 'z0' ? [cx, z + d + .22] : side === 'z1' ? [cx, z - .22] : side === 'x0' ? [x + w + .22, cz] : [x - .22, cz]; circ(fr[0], fr[1], .21, 'p-f'); continue; }
      if (kind === 'wardrobe') { R(x, z, x + w, z + d, 'p-f', 0); ln(x, z, x + w, z + d); ln(x, z + d, x + w, z); continue; }
      if (kind === 'bath') { R(x, z, x + w, z + d, 'p-f', 4); R(x + .07, z + .07, x + w - .07, z + d - .07, 'p-f p-water', 14); const dr = along ? [x + w - .22, cz] : [cx, z + d - .22]; circ(dr[0], dr[1], .025, 'p-fl'); continue; }
      if (kind === 'shower') { R(x, z, x + w, z + d, 'p-f p-water', 0); ln(x, z, x + w, z + d); ln(x, z + d, x + w, z); circ(cx, cz, .04, 'p-fl'); continue; }
      if (kind === 'wc') { const tk = strip(x, z, w, d, side, .16); R(...tk, 'p-f', 2); const s2 = side === 'z1' ? [cx, z + d - .16 - .2] : side === 'z0' ? [cx, z + .16 + .2] : side === 'x0' ? [x + .16 + .2, cz] : [x + w - .16 - .2, cz]; ell(s2[0], s2[1], along ? .18 : .22, along ? .22 : .18); continue; }
      if (kind === 'sink') { R(x, z, x + w, z + d, 'p-f', 2); ell(cx, cz, (along ? w : d) * .3 * (along ? 1 : .8), (along ? d : w) * .3); continue; }
    }
    o.push(`<g class="p-furn">${F.join('')}</g>`);
  }
  // labels
  // obstacles for label placement: furniture footprints (+ chairs round tables)
  const obs = [...swings];
  for (const [kind, x, z, w = .5, d = .5] of P.furn) { if (kind === 'rug') continue; if (kind === 'plant') { obs.push([x - .2, z - .2, x + .2, z + .2]); continue; }
    if (kind === 'kitchen-l') { obs.push([x, z + d - .62, x + w, z + d], [x, z, x + .62, z + d]); continue; } const e = kind === 'table' ? .32 : kind === 'desk' ? .25 : 0; obs.push([x - e, z - e, x + w + e, z + d + e]); }
  const dist = (px, pz, hw, hd, q) => { const dx = Math.max(q[0] - (px + hw), (px - hw) - q[2]), dz = Math.max(q[1] - (pz + hd), (pz - hd) - q[3]); return dx < 0 && dz < 0 ? Math.max(dx, dz) * 3 : Math.hypot(Math.max(dx, 0), Math.max(dz, 0)); };
  if (labels) for (const gR of groups) { const r = gR.main, w = r.x1 - r.x0, d = r.z1 - r.z0, small = Math.min(w, d) < 1.3 || gR.net < 3.5;
    const nm = t('room_' + gR.key), hw = Math.max(nm.length * (small ? .112 : .138), .75) / 2 + .03, hd = small ? .27 : .34;
    let lx = (r.x0 + r.x1) / 2, lz = (r.z0 + r.z1) / 2, best = -1;
    for (const part of gR.parts) for (let gx = 0; gx <= 8; gx++) for (let gz = 0; gz <= 8; gz++) {
      const mg = .14, px = part.x0 + hw + mg + (part.x1 - part.x0 - 2 * hw - 2 * mg) * gx / 8, pz = part.z0 + hd + mg + (part.z1 - part.z0 - 2 * hd - 2 * mg) * gz / 8;
      if (part.x1 - part.x0 < 2 * hw + .28) { if (gx) continue; } if (part.z1 - part.z0 < 2 * hd + .28) { if (gz) continue; }
      const cx = part.x1 - part.x0 < 2 * hw + .28 ? (part.x0 + part.x1) / 2 : px, cz = part.z1 - part.z0 < 2 * hd + .28 ? (part.z0 + part.z1) / 2 : pz;
      const m = Math.min(.8, ...obs.map(q => dist(cx, cz, hw, hd, q))) + (part === gR.main ? .05 : 0) - Math.hypot(cx - (part.x0 + part.x1) / 2, cz - (part.z0 + part.z1) / 2) * .04;
      if (m > best) { best = m; lx = cx; lz = cz; } }
    o.push(`<g class="p-lab${small ? ' sm' : ''}" transform="translate(${X(lx).toFixed(1)} ${Y(lz).toFixed(1)})"><text class="p-n" y="-3">${nm}</text><text class="p-a" y="${small ? 9 : 12}">${f1(gR.net)} m²</text></g>`); }
  if (out && labels) o.push(`<text class="p-n p-outlab" x="${X(W / 2)}" y="${Y(-out.depth / 2) + 4}">${t(out.kind === 'terrace' ? 'pl_terrace' : 'pl_balcony')} · ${out.area} m²</text>`);
  // overall dimensions
  if (dims) { const y = pad - 18, x = pad - 18;
    o.push(`<g class="p-dim"><line x1="${X(0)}" y1="${y}" x2="${X(W)}" y2="${y}"/><line x1="${X(0)}" y1="${y - 4}" x2="${X(0)}" y2="${y + 4}"/><line x1="${X(W)}" y1="${y - 4}" x2="${X(W)}" y2="${y + 4}"/><text x="${X(W / 2)}" y="${y - 4}">${f1(W)} m</text>`
      + `<line x1="${x}" y1="${Y(D)}" x2="${x}" y2="${Y(0)}"/><line x1="${x - 4}" y1="${Y(D)}" x2="${x + 4}" y2="${Y(D)}"/><line x1="${x - 4}" y1="${Y(0)}" x2="${x + 4}" y2="${Y(0)}"/><text transform="translate(${x - 5} ${Y(D / 2)}) rotate(-90)">${f1(D)} m</text></g>`); }
  return `<svg class="plan-svg ${cls}" viewBox="0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}" role="img" aria-label="${t('pl_aria', { t: t('type_' + type) })}">${o.join('')}</svg>`;
}
