// Vėjo laiptai — building + apartment plan viewer (procedural, one renderer)
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { mergeGeometries as mg0 } from './lib/BufferGeometryUtils.js';
const mergeGeometries = list => mg0(list.map(g => g.index ? g.toNonIndexed() : g));
function worldUV(g, s = 1) { const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > .5) uv.setXY(i, p.getX(i) * s, p.getZ(i) * s); else if (ax > .5) uv.setXY(i, p.getZ(i) * s, p.getY(i) * s); else uv.setXY(i, p.getX(i) * s, p.getY(i) * s); } return g; }
function brickTex(base, seed) { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, 512, 512); let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bh = 512 / 26, bw = 64; for (let row = 0; row < 26; row++) for (let k = -1; k < 9; k++) { const x = k * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
    const l = base[2] + (r() - .5) * 9, h = base[0] + (r() - .5) * 8; g.fillStyle = `hsl(${h},${base[1]}%,${l}%)`; g.fillRect(x + 2, y + 2, bw - 4, bh - 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
import { VOLS, VW, DEPTH, FH, UNITS, PLANS } from './data.js';

const LOW = matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const D2R = Math.PI / 180;

export async function createEstate({ pause = () => new Promise(r => setTimeout(r, 0)) } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement; canvas.className = 'gl'; canvas.setAttribute('aria-hidden', 'true');
  const pmrem = new THREE.PMREMGenerator(renderer);
  await pause(); const envTex = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  await pause();

  /* ================= building scene ================= */
  const S = new THREE.Scene(); S.environment = envTex; S.environmentIntensity = .5;
  const SKY = new THREE.Color(0xdfe3e2); S.background = SKY; S.fog = new THREE.Fog(SKY, 110, 230);
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 600);
  const sun = new THREE.DirectionalLight(0xfff0dc, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 40, bottom: -40, near: 10, far: 260 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .06; S.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x8a8370, .55); S.add(hemi);

  const M = {
    brick: new THREE.MeshStandardMaterial({ map: brickTex([26, 32, 66], 3), roughness: .92 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xece7df, roughness: .8 }),
    side: new THREE.MeshStandardMaterial({ map: brickTex([24, 28, 62], 11), roughness: .93 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9a6d47, roughness: .7 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x2c2c2a, roughness: .5, metalness: .4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x6d7f8c, roughness: .12, metalness: .7, emissive: 0xffc27a, emissiveIntensity: 0 }),
    glassLit: new THREE.MeshStandardMaterial({ color: 0x6d7f8c, roughness: .12, metalness: .7, emissive: 0xffc27a, emissiveIntensity: 0 }),
    rail: new THREE.MeshStandardMaterial({ color: 0xbcd0d6, roughness: .05, metalness: .2, transparent: true, opacity: .32, depthWrite: false }),
    lobby: new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: .1, metalness: .6, emissive: 0xffd9a8, emissiveIntensity: .1 }),
    green: new THREE.MeshStandardMaterial({ color: 0x55703c, roughness: .95 }),
    green2: new THREE.MeshStandardMaterial({ color: 0x7d9150, roughness: .95 }),
    green3: new THREE.MeshStandardMaterial({ color: 0x3f5a35, roughness: .95 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: 0xa9ae8a, roughness: 1 }),
    paving: new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: .95 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: .95 }),
    deck: new THREE.MeshStandardMaterial({ color: 0xb08a63, roughness: .8 })
  };
  const parts = {}; const add = (mat, g) => (parts[mat] = parts[mat] || []).push(g);
  const box = (mat, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); add(mat, g); };

  await pause();
  const FZ = DEPTH / 2; // front face z
  const rr2 = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (const v of VOLS) {
    const H = v.floors * FH, cx = v.x0 + VW / 2;
    // core body slightly recessed so the facade elements read
    box('side', VW - .2, H, DEPTH - .6, cx, H / 2, -.3);
    // roof parapet + deck
    box('roof', VW, .25, DEPTH, cx, H + .12, 0);
    box('slab', VW + .2, .5, .25, cx, H + .4, FZ); box('slab', VW + .2, .5, .25, cx, H + .4, -FZ);
    box('slab', .25, .5, DEPTH, v.x0 - .02, H + .4, 0); box('slab', .25, .5, DEPTH, v.x0 + VW + .02, H + .4, 0);
    // ground floor: lobby / café glass
    box('lobby', VW - .6, FH - .4, .1, cx, (FH - .4) / 2, FZ - .2);
    for (let x = v.x0 + 1.5; x < v.x0 + VW; x += 3) box('frame', .12, FH - .4, .2, x, (FH - .4) / 2, FZ - .1);
    // floor slabs (bands)
    for (let f = 1; f <= v.floors; f++) box('slab', VW + .1, .32, DEPTH + .1, cx, f * FH - .16, 0);
    // side walls: brick with slot windows
    for (const sx of [v.x0, v.x0 + VW]) {
      for (let f = 1; f < v.floors; f++) for (let k = 0; k < 3; k++) box('glass', .06, 1.8, 1.2, sx + (sx === v.x0 ? -.02 : .02), f * FH + 1.25, -4 + k * 4);
    }
    // back facade: simple window grid
    for (let f = 1; f < v.floors; f++) for (let k = 0; k < 6; k++) box(rr2() < .3 ? 'glassLit' : 'glass', 1.6, 2.0, .06, v.x0 + 1.5 + k * 3, f * FH + 1.2, -FZ - .02);
    // roof terrace greenery on top
    for (let k = 0; k < 5; k++) box('green2', 1.2, .5, .8, v.x0 + 2 + k * 3.4, H + .5, FZ - 1);
  }
  await pause();
  // front facade per unit
  for (const u of UNITS) {
    const y0 = u.floor * FH, x0 = u.x, w = u.w, cx = x0 + w / 2;
    // brick piers at unit edges
    box('brick', .5, FH - .32, .5, x0 + .25, y0 + (FH - .32) / 2, FZ - .2);
    // window wall
    const ww = w - .9; box(rr2() < .35 ? 'glassLit' : 'glass', ww, FH - .7, .08, cx, y0 + (FH - .32) / 2 + .05, FZ - .35);
    for (let x = x0 + .5 + ww / 3; x < x0 + w - .45; x += ww / 3) box('frame', .07, FH - .7, .14, x, y0 + (FH - .32) / 2 + .05, FZ - .3);
    // timber fins
    const nf = Math.max(3, Math.round(ww / 1.2));
    if (!u.top) for (let k = 0; k <= nf; k++) if (k % 2 === 0) box('wood', .1, FH - .32, .3, x0 + .5 + k * ww / nf, y0 + (FH - .32) / 2, FZ + .05);
    // balcony / terrace
    if (u.terrace) {
      const bd = u.top ? 3.2 : 1.7, bw = u.top ? w - .4 : Math.min(w - .8, 4.6), bx = u.top ? cx : x0 + .4 + bw / 2;
      box('slab', bw, .22, bd, bx, y0 + .02, FZ + bd / 2);
      box('rail', bw, 1.05, .04, bx, y0 + .62, FZ + bd); box('rail', .04, 1.05, bd, bx - bw / 2, y0 + .62, FZ + bd / 2); box('rail', .04, 1.05, bd, bx + bw / 2, y0 + .62, FZ + bd / 2);
      if (u.top) { box('deck', bw - .2, .04, bd - .2, bx, y0 + .15, FZ + bd / 2); box('green', 1, .6, .6, bx - bw / 2 + .8, y0 + .45, FZ + bd - .5); box('green', 1, .6, .6, bx + bw / 2 - .8, y0 + .45, FZ + bd - .5); }
    }
  }
  // right side of A and B: brick pier ends
  for (const v of VOLS) box('brick', .5, (v.floors - 1) * FH, .5, v.x0 + VW - .25, FH + (v.floors - 1) * FH / 2, FZ - .2);

  await pause();
  // ground: grass, paving, paths, trees
  const g0 = new THREE.CircleGeometry(150, 48); g0.rotateX(-Math.PI / 2); add('grass', g0);
  box('paving', 64, .06, 10, 0, .03, FZ + 5.5); box('paving', 4, .06, 30, -18, .03, FZ + 20); box('paving', 4, .06, 30, 18, .03, FZ + 20);
  const rr = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const tr = (x, z, s) => { const t = new THREE.CylinderGeometry(.18 * s, .25 * s, 2.6 * s, 6); t.translate(x, 1.3 * s, z); add('trunk', t);
    const mat = ['green', 'green2', 'green3'][Math.floor(rr() * 3)];
    for (let b = 0; b < 5; b++) { const rad = (1.1 + rr() * .7) * s; const c = new THREE.IcosahedronGeometry(rad, LOW ? 1 : 2); const p = c.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 3.1 + b) * Math.cos(p.getZ(i) * 2.7) * .12); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .85, p.getZ(i) * k); }
      c.computeVertexNormals(); c.translate(x + (rr() - .5) * 2.2 * s, (3.2 + rr() * 1.8) * s, z + (rr() - .5) * 2.2 * s); add(mat, c); } };
  for (let i = 0; i < 26; i++) { const x = -60 + rr() * 120, z = FZ + 12 + rr() * 30; if (Math.abs(x) < 34 && z < FZ + 14) continue; tr(x, z, .8 + rr() * .6); }
  for (let i = 0; i < 18; i++) tr(-70 + rr() * 140, -FZ - 8 - rr() * 30, .9 + rr() * .7);
  for (let i = 0; i < 6; i++) tr(-40 + i * 16, FZ + 11, 1.15);

  await pause();
  const bld = new THREE.Group(); let nMerged = 0;
  for (const [k, list] of Object.entries(parts)) {
    if (++nMerged % 5 === 0) await pause();
    if (k === 'brick' || k === 'side') list.forEach(g => worldUV(g, .5));
    const mesh = new THREE.Mesh(mergeGeometries(list), M[k]);
    mesh.castShadow = !['grass', 'paving', 'rail'].includes(k); mesh.receiveShadow = k !== 'rail' && k !== 'glass' && k !== 'glassLit';
    bld.add(mesh);
  }
  S.add(bld);

  await pause();
  // clickable overlays
  const COL = { free: 0x4f8a63, reserved: 0xd29a3a, sold: 0x8a8580, sel: 0xc2502a, match: 0x4f8a63 };
  const ovGroup = new THREE.Group(); S.add(ovGroup);
  const ovMat = {}; const ovGeo = new THREE.BoxGeometry(1, 1, 1);
  const overlays = UNITS.map(u => {
    const m = new THREE.Mesh(ovGeo, new THREE.MeshBasicMaterial({ color: COL[u.status], transparent: true, opacity: .5, depthWrite: false }));
    const bd = u.terrace ? (u.top ? 3.3 : 1.8) : .5;
    m.scale.set(u.w - .16, FH - .4, bd + .5); m.position.set(u.x + u.w / 2, u.floor * FH + (FH - .32) / 2, FZ - .2 + bd / 2 + .1);
    m.userData.u = u; m.renderOrder = 2; ovGroup.add(m); return m;
  });
  let ovOn = false, selId = null, hovId = null, filterFn = null;
  function paintOverlays() {
    for (const m of overlays) {
      const u = m.userData.u, match = !filterFn || filterFn(u);
      const sel = u.id === selId, hov = u.id === hovId;
      m.visible = ovOn && (match || sel);
      m.material.color.setHex(sel ? COL.sel : COL[u.status]);
      m.material.opacity = sel ? .85 : hov ? .72 : u.status === 'sold' ? .32 : .5;
    }
    kick();
  }

  /* ---- sun ---- */
  // simplified sun path for Vilnius (54.7° N). month: 'jun' | 'mar' | 'dec'
  const SEASON = { jun: { rise: 4.7, set: 22.0, max: 58.5 }, mar: { rise: 6.6, set: 18.8, max: 35.5 }, dec: { rise: 8.7, set: 15.9, max: 11.8 } };
  const FACADE_AZ = 225; // front faces south-west
  function sunAt(h, season) {
    const s = SEASON[season]; const noon = 13.2; // solar noon in local summer/winter time, approx.
    const day = (h - s.rise) / (s.set - s.rise);
    const el = day <= 0 || day >= 1 ? -6 : s.max * Math.sin(Math.PI * day);
    const az = 180 + (h - noon) / ((s.set - s.rise) / 2) * (season === 'jun' ? 128 : season === 'mar' ? 90 : 52);
    return { el, az };
  }
  function sunHours(season) { let n = 0; for (let h = 0; h < 24; h += .25) { const { el, az } = sunAt(h, season); let d = Math.abs(((az - FACADE_AZ + 540) % 360) - 180); if (el > 4 && d < 80) n += .25; } return n; }
  let sunState = { h: 17.5, season: 'jun' };
  function setSun(h, season = sunState.season) {
    sunState = { h, season }; const { el, az } = sunAt(h, season);
    // scene axes: +z = facade normal (south-west). azimuth measured from north, clockwise.
    const rel = (az - FACADE_AZ) * D2R, e = Math.max(el, -4) * D2R;
    const dir = new THREE.Vector3(Math.sin(rel) * Math.cos(e), Math.sin(e), Math.cos(rel) * Math.cos(e));
    sun.position.copy(dir.multiplyScalar(120)).add(new THREE.Vector3(0, 8, 0)); sun.target.position.set(0, 8, 0);
    const k = THREE.MathUtils.clamp(el / 25, 0, 1), dusk = THREE.MathUtils.clamp(1 - el / 14, 0, 1);
    sun.intensity = el > 0 ? 0.6 + 2.6 * k : 0; sun.color.setHSL(.08, .55 + .3 * dusk * (el > 0), .62 + .2 * k);
    hemi.intensity = .18 + .45 * THREE.MathUtils.clamp((el + 6) / 20, 0, 1);
    S.environmentIntensity = .15 + .4 * THREE.MathUtils.clamp((el + 6) / 26, 0, 1);
    const night = THREE.MathUtils.clamp((4 - el) / 10, 0, 1);
    M.glassLit.emissiveIntensity = night * 1.05; M.glass.emissiveIntensity = 0; M.lobby.emissiveIntensity = .1 + night * .7;
    const day = new THREE.Color(0xdfe3e2), gold = new THREE.Color(0xeedac3), dark = new THREE.Color(0x27303d);
    SKY.copy(day).lerp(gold, el > 0 ? THREE.MathUtils.clamp(1 - el / 18, 0, 1) * .8 : 0).lerp(dark, night); S.fog.color.copy(SKY);
    renderer.toneMappingExposure = .9 + .25 * (1 - k);
    renderer.shadowMap.needsUpdate = true; kick();
    return { el, az, night, k };
  }

  /* ================= plan scene ================= */
  const P = new THREE.Scene(); P.environment = envTex; P.environmentIntensity = .55;
  const pcam = new THREE.PerspectiveCamera(32, 1, .1, 200);
  const pk = new THREE.DirectionalLight(0xfff3e4, 2.3); pk.castShadow = true; pk.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(pk.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 }); pk.shadow.bias = -.0005; pk.shadow.normalBias = .02; pk.shadow.radius = 4;
  P.add(pk, pk.target, new THREE.HemisphereLight(0xffffff, 0xcfc6b8, .55));
  const loader = new THREE.TextureLoader();
  const oak = loader.load(new URL('./tex/oak_d1.webp', import.meta.url).href, t => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(.45, .45); t.anisotropy = 8; kick(); });
  const PM = {
    floor: new THREE.MeshStandardMaterial({ map: oak, roughness: .55 }),
    tile: new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: .4 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: .9 }),
    cut: new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: .9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa9c4cc, roughness: .05, transparent: true, opacity: .35, depthWrite: false }),
    fabric: new THREE.MeshStandardMaterial({ color: 0xb9ad9c, roughness: 1 }),
    fabric2: new THREE.MeshStandardMaterial({ color: 0x6f7e6a, roughness: 1 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa07850, roughness: .6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: .35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3b3936, roughness: .5 }),
    rug: new THREE.MeshStandardMaterial({ color: 0xcbbfae, roughness: 1 }),
    green: new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 1, flatShading: true }),
    deck: new THREE.MeshStandardMaterial({ color: 0xb59372, roughness: .85 }),
    ground: new THREE.ShadowMaterial({ opacity: .14 })
  };
  const planRoot = new THREE.Group(); P.add(planRoot);
  const pground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), PM.ground); pground.rotation.x = -Math.PI / 2; pground.position.y = -.01; pground.receiveShadow = true; P.add(pground);
  let planLabels = [], planCenter = new THREE.Vector3(), planSize = 10, furnGroup = null;

  function buildPlan(type, opts = {}) {
    planRoot.clear(); const p = PLANS[type]; const parts = {}; const addp = (m, g) => (parts[m] = parts[m] || []).push(g);
    const pb = (m, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); addp(m, g); };
    const WH = 2.55, T = .12, TE = .26;
    // floors
    for (const [n, x0, z0, x1, z1] of p.rooms) { const wet = /Bath|WC/.test(n); const g = new THREE.BoxGeometry(x1 - x0, .06, z1 - z0); g.translate((x0 + x1) / 2, .03, (z0 + z1) / 2);
      if (!wet) { const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i)); } addp(wet ? 'tile' : 'floor', g); }
    // walls from room edges: union per line, minus openings
    const H = new Map(), V = new Map(); const k = n => Math.round(n * 100) / 100;
    const push = (map, key, a, b) => { (map.get(key) || map.set(key, []).get(key)).push([Math.min(a, b), Math.max(a, b)]); };
    for (const [, x0, z0, x1, z1] of p.rooms) { push(H, k(z0), x0, x1); push(H, k(z1), x0, x1); push(V, k(x0), z0, z1); push(V, k(x1), z0, z1); }
    const union = l => { l.sort((a, b) => a[0] - b[0]); const o = []; for (const s of l) { const t = o[o.length - 1]; if (t && s[0] <= t[1] + 1e-3) t[1] = Math.max(t[1], s[1]); else o.push([...s]); } return o; };
    const cutOut = (segs, holes) => { let out = segs; for (const [a, b] of holes) { const n = []; for (const [s, e] of out) { if (b <= s || a >= e) n.push([s, e]); else { if (a > s) n.push([s, a]); if (b < e) n.push([b, e]); } } out = n; } return out; };
    const openH = new Map(), openV = new Map();
    for (const [x0, z0, x1, z1] of p.open) { if (Math.abs(z0 - z1) < 1e-3) push(openH, k(z0), x0, x1); else push(openV, k(x0), z0, z1); }
    for (const [z, l] of H) {
      const ext = z === 0 || z === k(p.D); const th = ext ? TE : T;
      for (const [a, b] of cutOut(union(l), openH.get(z) || [])) {
        if (b - a < .02) continue;
        if (z === 0) { // window wall: low sill + glass + head
          pb('wall', b - a, .45, th, (a + b) / 2, .225, z); pb('glass', b - a, WH - .7, .04, (a + b) / 2, .45 + (WH - .7) / 2, z);
          for (let x = a; x <= b + 1e-3; x += Math.max(1, (b - a) / Math.max(1, Math.round((b - a) / 1.4)))) pb('dark', .05, WH - .7, .08, Math.min(x, b), .45 + (WH - .7) / 2, z);
          pb('wall', b - a, .25, th, (a + b) / 2, WH - .125, z);
        } else pb('wall', b - a + (ext ? th : 0), WH, th, (a + b) / 2, WH / 2, z);
      }
    }
    for (const [x, l] of V) {
      const ext = x === 0 || x === k(p.W); const th = ext ? TE : T;
      for (const [a, b] of cutOut(union(l), openV.get(x) || [])) if (b - a > .02) pb('wall', th, WH, b - a, x, WH / 2, (a + b) / 2);
    }
    // wall-top "cut" lines for a crisp plan read
    // terrace / balcony in front
    const U = opts.terrace || 0;
    if (U) { const td = type === 'P4' ? 4.2 : 1.6, tw = type === 'P4' ? p.W : Math.min(p.W - .6, 4.6); const tx = type === 'P4' ? p.W / 2 : .3 + tw / 2;
      const g = new THREE.BoxGeometry(tw, .08, td); g.translate(tx, .0, -td / 2 - TE / 2); addp('deck', g);
      pb('glass', tw, 1.0, .04, tx, .55, -td - TE / 2); pb('glass', .04, 1.0, td, tx - tw / 2, .55, -td / 2 - TE / 2); pb('glass', .04, 1.0, td, tx + tw / 2, .55, -td / 2 - TE / 2);
      if (type === 'P4') { pb('green', .9, .6, .9, .7, .3, -td + .5); pb('green', .9, .6, .9, p.W - .7, .3, -td + .5); pb('wood', 1.8, .42, .8, p.W / 2 - 1.5, .21, -2.2); }
      else pb('wood', .7, .45, .7, tx, .225, -.9);
    }
    const shell = new THREE.Group();
    for (const [m, l] of Object.entries(parts)) { const mesh = new THREE.Mesh(mergeGeometries(l), PM[m]); mesh.castShadow = m !== 'glass' && m !== 'floor' && m !== 'tile'; mesh.receiveShadow = m !== 'glass'; shell.add(mesh); }
    planRoot.add(shell);
    furnGroup = buildFurniture(p.furn); planRoot.add(furnGroup); furnGroup.visible = opts.furniture !== false;
    planRoot.position.set(-p.W / 2, 0, -p.D / 2);
    planCenter.set(0, 0, 0); planSize = Math.max(p.W, p.D + (U ? 3 : 0));
    pk.position.set(-6, 14, -9); pk.target.position.set(0, 0, 0);
    Object.assign(pk.shadow.camera, { left: -planSize * .8, right: planSize * .8, top: planSize * .8, bottom: -planSize * .8 }); pk.shadow.camera.updateProjectionMatrix();
    planLabels = p.rooms.map(([n, x0, z0, x1, z1]) => ({ name: n, area: ((x1 - x0) * (z1 - z0)).toFixed(1), pos: new THREE.Vector3((x0 + x1) / 2 - p.W / 2, .1, (z0 + z1) / 2 - p.D / 2) }));
    if (U) planLabels.push({ name: type === 'P4' ? 'Terrace' : 'Balcony', area: U.toFixed(1), pos: new THREE.Vector3((type === 'P4' ? 0 : -p.W / 2 + .3 + Math.min(p.W - .6, 4.6) / 2), .1, -p.D / 2 - (type === 'P4' ? 2.2 : .9)) });
    pyaw = Math.PI - .55; ptilt = .95; renderer.shadowMap.needsUpdate = true; kick();
    return planLabels;
  }
  function buildFurniture(list) {
    const parts = {}; const addp = (m, g) => (parts[m] = parts[m] || []).push(g);
    const fb = (m, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); addp(m, g); };
    for (const [kind, x, z, w = .5, d = .5, rot = 0, n = 4] of list) {
      const cx = x + w / 2, cz = z + d / 2;
      switch (kind) {
        case 'bed': fb('wood', w, .3, d, cx, .15, cz); fb('linen', w - .06, .2, d - .25, cx, .4, cz + .1); fb('fabric', w - .02, .12, d * .55, cx, .52, cz + d * .2); fb('linen', w * .4, .14, .35, cx - w * .24, .55, z + .3); fb('linen', w * .4, .14, .35, cx + w * .24, .55, z + .3); fb('wood', w + .1, .9, .08, cx, .45, z + .02); break;
        case 'side': fb('wood', w, .45, d, cx, .225, cz); break;
        case 'sofa': if (rot) { fb('fabric2', w, .4, d, cx, .2, cz); fb('fabric2', .22, .75, d, x + .11, .37, cz); fb('fabric2', w, .6, .2, cx, .3, z + .1); fb('fabric2', w, .6, .2, cx, .3, z + d - .1); }
          else { fb('fabric2', w, .4, d, cx, .2, cz); fb('fabric2', w, .75, .22, cx, .37, z + .11); fb('fabric2', .2, .6, d, x + .1, .3, cz); fb('fabric2', .2, .6, d, x + w - .1, .3, cz); } break;
        case 'rug': fb('rug', w, .015, d, cx, .068, cz); break;
        case 'ctable': fb('wood', w, .38, d, cx, .19, cz); break;
        case 'table': { fb('wood', w, .04, d, cx, .74, cz); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fb('dark', .05, .72, .05, cx + sx * (w / 2 - .08), .36, cz + sz * (d / 2 - .08));
          const per = Math.ceil(n / 2); for (let i = 0; i < per; i++) { const px = x + (i + .5) * w / per; for (const sz of [-1, 1]) { const zz = cz + sz * (d / 2 + .22); fb('wood', .42, .05, .42, px, .45, zz); fb('wood', .42, .4, .04, px, .68, zz + sz * .2); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fb('dark', .03, .45, .03, px + a * .18, .22, zz + b * .18); } } break; }
        case 'kitchen': fb('white', w, .88, d, cx, .44, cz); fb('dark', w, .04, d + .02, cx, .9, cz); fb('white', rot ? .35 : w, .7, rot ? d : .35, rot ? x + w - .17 : cx, 1.85, rot ? cz : z + d - .17); break;
        case 'kitchen-l': fb('white', w, .88, .62, cx, .44, z + d - .31); fb('dark', w, .04, .64, cx, .9, z + d - .31); if (d > 1) { fb('white', .62, .88, d - .62, x + .31, .44, z + (d - .62) / 2); fb('dark', .64, .04, d - .62, x + .31, .9, z + (d - .62) / 2); } break;
        case 'island': fb('wood', w, .9, d, cx, .45, cz); fb('white', w + .06, .04, d + .06, cx, .92, cz); break;
        case 'wardrobe': fb('white', w, 2.2, d, cx, 1.1, cz); break;
        case 'desk': fb('wood', w, .04, d, cx, .74, cz); fb('dark', .04, .72, d, x + .04, .36, cz); fb('dark', .04, .72, d, x + w - .04, .36, cz); fb('dark', .45, .45, .45, cx, .45, cz + d / 2 + .1); break;
        case 'bath': fb('white', w, .55, d, cx, .275, cz); break;
        case 'shower': fb('tile', w, .05, d, cx, .09, cz); fb('glass', .03, 2.0, d, x, 1.0, cz); break;
        case 'wc': fb('white', w, .4, d * .7, cx, .2, z + d * .55); fb('white', w, .35, .18, cx, .55, z + d - .09); break;
        case 'sink': fb('white', w, .18, d, cx, .8, cz); fb('wood', w, .4, d, cx, .55, cz); break;
        case 'plant': { const g = new THREE.CylinderGeometry(.16, .12, .35, 12); g.translate(x, .18, z); addp('dark', g); const c = new THREE.IcosahedronGeometry(.36, 0); c.translate(x, .75, z); addp('green', c); break; }
      }
    }
    const g = new THREE.Group();
    for (const [m, l] of Object.entries(parts)) { const mesh = new THREE.Mesh(mergeGeometries(l), PM[m]); mesh.castShadow = m !== 'glass'; mesh.receiveShadow = true; g.add(mesh); }
    return g;
  }

  /* ================= cameras / input ================= */
  let mode = 'building', host = null, visible = false, running = false, needs = true;
  let yaw = -.38, tilt = .2, dist = 1, vel = 0, auto = 0; let pyaw = Math.PI - .55, ptilt = .95, pzoom = 1;
  const target = new THREE.Vector3(4, 10.5, 2);
  function placeCam() {
    const a = cam.aspect;
    const base = a < 1 ? 122 / Math.max(.5, a) : 128 / Math.min(1.5, Math.max(.9, a * .85));
    const d = base * dist; cam.position.set(target.x + Math.sin(yaw) * Math.cos(tilt) * d, target.y + Math.sin(tilt) * d, target.z + Math.cos(yaw) * Math.cos(tilt) * d); cam.lookAt(target);
  }
  function placePcam() {
    const a = pcam.aspect; const d = (planSize * 2.25 + 3) / Math.min(1.25, Math.max(.6, a)) * pzoom;
    pcam.position.set(Math.sin(pyaw) * Math.cos(ptilt) * d, Math.sin(ptilt) * d, Math.cos(pyaw) * Math.cos(ptilt) * d); pcam.lookAt(0, -.4, 0);
  }
  function size() { if (!host || mode === 'ext') return; const r = host.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); cam.aspect = pcam.aspect = r.width / r.height; cam.updateProjectionMatrix(); pcam.updateProjectionMatrix(); needs = true; }
  let last = 0, onFrame = null;
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; let moving = false;
    if (!dragging) {
      if (Math.abs(vel) > .0004) { if (mode === 'building') yaw += vel; else pyaw += vel; vel *= .92; moving = true; }
      else if (host?.dataset.spin && !RM && mode === 'plan') { auto = Math.min(1, auto + dt * .4); pyaw += .05 * dt * auto; moving = true; }
    }
    if (zoomT) { moving = true; const k = Math.min(1, (t - zoomT.t0) / 700), e = 1 - (1 - k) ** 3; dist = zoomT.a + (zoomT.b - zoomT.a) * e; target.lerpVectors(zoomT.ta, zoomT.tb, e); if (k >= 1) zoomT = null; }
    if (mode === 'ext') { running = false; return; }
    if (moving || needs) {
      if (mode === 'building') { yaw = THREE.MathUtils.clamp(yaw, -1.15, 1.15); placeCam(); renderer.render(S, cam); }
      else { placePcam(); renderer.render(P, pcam); }
      needs = false; onFrame && onFrame();
    }
    if (moving || dragging) requestAnimationFrame(loop); else running = false;
  }
  const kick = () => { needs = true; if (!running && visible) { running = true; requestAnimationFrame(loop); } };
  let zoomT = null;
  function focusUnit(u) {
    if (!u) { zoomT = { a: dist, b: 1, ta: target.clone(), tb: new THREE.Vector3(4, 10.5, 2), t0: performance.now() }; kick(); return; }
    const nar = cam.aspect < 1.1; zoomT = { a: dist, b: nar ? .7 : .62, ta: target.clone(), tb: nar ? new THREE.Vector3(u.x + u.w / 2, u.floor * FH - 3, 2) : new THREE.Vector3(u.x + u.w / 2 + 11, u.floor * FH + 1.5, 2), t0: RM ? -1e9 : performance.now() }; kick();
  }

  // input: horizontal drag rotates, vertical swipe scrolls the page; tap selects
  let dragging = false, pending = false, px = 0, py = 0, lastX = 0, lastT = 0, downAt = 0, moved = false;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', e => { pending = true; moved = false; px = lastX = e.clientX; py = e.clientY; lastT = downAt = performance.now(); if (e.pointerType === 'mouse') startDrag(); });
  function startDrag() { pending = false; dragging = true; vel = 0; auto = 0; host?.classList.add('grab'); kick(); }
  addEventListener('pointermove', e => {
    if (pending) { const dx = Math.abs(e.clientX - px), dy = Math.abs(e.clientY - py); if (dx > 8 && dx > dy * 1.3) startDrag(); else if (dy > 8) pending = false; else return; }
    if (!dragging) { if (e.target === canvas && e.pointerType === 'mouse') hover(e); return; }
    const dx = e.clientX - lastX; if (Math.abs(e.clientX - px) > 4) moved = true;
    const sp = mode === 'building' ? .0035 : .006; if (mode === 'building') yaw -= dx * sp; else pyaw -= dx * sp;
    const now = performance.now(); vel = -dx * sp * Math.min(1, 16 / Math.max(1, now - lastT)); lastX = e.clientX; lastT = now; needs = true;
  });
  const up = e => { const wasTap = (pending || dragging) && !moved && performance.now() - downAt < 450 && e.target === canvas; pending = false; if (dragging) { dragging = false; host?.classList.remove('grab'); kick(); } if (wasTap && mode === 'building') tap(e); };
  addEventListener('pointerup', up); addEventListener('pointercancel', () => { pending = false; dragging = false; });
  canvas.addEventListener('wheel', e => { if (mode !== 'plan' || !e.ctrlKey && Math.abs(e.deltaY) < 1) return; }, { passive: true });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) { if (!ovOn) return null; const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam); const hit = ray.intersectObjects(overlays.filter(o => o.visible), false)[0]; return hit ? hit.object.userData.u : null; }
  let onPick = null, onHover = null;
  function tap(e) { const u = pick(e); if (u && onPick) onPick(u); }
  let hovRaf = 0;
  function hover(e) { cancelAnimationFrame(hovRaf); hovRaf = requestAnimationFrame(() => { const u = pick(e); const id = u ? u.id : null; if (id !== hovId) { hovId = id; canvas.style.cursor = u ? 'pointer' : ''; paintOverlays(); onHover && onHover(u, e); } else if (u && onHover) onHover(u, e); }); }
  canvas.addEventListener('pointerleave', () => { if (hovId) { hovId = null; paintOverlays(); onHover && onHover(null); } });

  // screen position of a world point (for labels)
  const v3 = new THREE.Vector3();
  function project(p) { v3.copy(p); v3.project(mode === 'plan' ? pcam : cam); const r = host.getBoundingClientRect(); return { x: (v3.x * .5 + .5) * r.width, y: (-v3.y * .5 + .5) * r.height, z: v3.z }; }
  function unitScreen(u) { v3.set(u.x + u.w / 2, u.floor * FH + FH * .9, FZ + 1); v3.project(cam); const r = host.getBoundingClientRect(); return { x: (v3.x * .5 + .5) * r.width, y: (-v3.y * .5 + .5) * r.height }; }

  // mount / visibility
  const io = new IntersectionObserver(es => { for (const e of es) if (e.target === host) { visible = e.isIntersecting; if (visible) kick(); } }, { rootMargin: '60px' });
  let lw = 0, lh = 0; const ro = new ResizeObserver(es => { const r = es[0].contentRect; if (Math.abs(r.width - lw) < 1 && Math.abs(r.height - lh) < 1) return; lw = r.width; lh = r.height; size(); kick(); });
  function mount(el, m) {
    if (m === 'ext') { mode = 'ext'; return canvas; }
    mode = m; if (host !== el) { if (host) { io.unobserve(host); ro.unobserve(host); } host = el; io.observe(el); ro.observe(el); lw = lh = 0; }
    if (canvas.parentNode !== el) el.prepend(canvas); canvas.style.touchAction = 'pan-y';
    visible = true; vel = 0; size(); renderer.shadowMap.needsUpdate = true; kick();
    if (m === 'building' && !warmed) { warmed = true; placeCam(); renderer.render(S, cam); }
  }
  let warmed = false;

  paintOverlays(); setSun(17.5, 'jun');
  // warm the shaders once the page is idle
  // shaders: compile before the first visible frame (parallel where the browser supports it)
  async function warm() { placeCam(); try { if (renderer.compileAsync) await renderer.compileAsync(S, cam); else renderer.compile(S, cam); } catch {} }

  return {
    renderer, mount, kick, warm, setSun, sunAt, sunHours, focusUnit, project, unitScreen, buildPlan,
    get mode() { return mode; },
    set onFrame(f) { onFrame = f; }, set onPick(f) { onPick = f; }, set onHover(f) { onHover = f; },
    overlays(on) { ovOn = on; paintOverlays(); },
    select(id) { selId = id; paintOverlays(); },
    filter(fn) { filterFn = fn; paintOverlays(); },
    furniture(on) { if (furnGroup) { furnGroup.visible = on; renderer.shadowMap.needsUpdate = true; kick(); } },
    planZoom(z) { pzoom = z; kick(); },
    cam(o) { if (o.yaw != null) yaw = o.yaw; if (o.tilt != null) tilt = o.tilt; if (o.dist != null) dist = o.dist; if (o.target) target.set(...o.target); kick(); },
    view(name) { if (name === 'top') { ptilt = 1.45; } else { ptilt = .95; } kick(); }
  };
}
