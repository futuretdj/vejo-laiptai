// Vėjo laiptai — walk-through interior designer.
// Builds a furnished apartment from PLANS, lets you walk in first person or orbit a dollhouse,
// and swaps paint, floors, tiles, kitchen, bathroom, lights and furniture live. Shares the page renderer.
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { RoundedBoxGeometry } from './lib/RoundedBoxGeometry.js';
import { mergeGeometries as mg0 } from './lib/BufferGeometryUtils.js';
import { PLANS } from './data.js';

const A = p => new URL(p, import.meta.url).href;
const LOW = matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
const WH = 2.8, DH = 2.1, WT = 2.52, TI = .12, TE = .26, EYE = 1.62, RAD = .24, PI = Math.PI;

export const ROOMKEY = { 'Living & sleeping': 'living_sleep', 'Kitchen': 'kitchen', 'Bathroom': 'bath', 'Hall': 'hall', 'Living & kitchen': 'living_kitchen', 'Bedroom': 'bedroom', 'WC': 'wc', 'Living & dining': 'living_dining', 'Study': 'study', 'Main bedroom': 'main_bedroom' };
const WET = new Set(['bath', 'wc']);
export const OPTIONS = {
  paint: { chalk: '#f1eee8', sand: '#e2d3bd', sage: '#c3cab5', clay: '#d3ae97', stone: '#b9b7b0', ink: '#3e4a52' },
  floor: { oak: '#c8a77f', chevron: '#b48f66', smoked: '#6e5a48', micro: '#bdb6aa' },
  tile: { porcelain: '#e4e0d9', terrazzo: '#e9e2d6', zellige: '#2f6b57', slate: '#4a4d4c' },
  wood: { oak: '#c49a6c', ash: '#e0c9a6', walnut: '#6b4a35' },
  fabric: { oat: '#d9cfbd', moss: '#5f6b4e', rust: '#a65a3a', charcoal: '#3b3b3a', sky: '#9fb3bf' },
  fronts: { white: '#efede8', sage: '#97a28c', navy: '#2f3b4b', oak: '#c49a6c' },
  worktop: { quartz: '#f2f0ec', black: '#1f1f1f', oak: '#c49a6c', terrazzo: '#e9e2d6' },
  metal: { chrome: '#d9d9d9', black: '#1c1c1c', brass: '#b48f55' },
  light: { spots: '#f5f1e8', globe: '#f6f2ea', cone: '#2b2b2b', linear: '#8a8a8a' },
  sofa: { debesis: '#c49a6c', pilis: '#d9cfbd' }, table: { rect: '#c49a6c', round: '#c49a6c' },
  rug: { wool: '#e7dfd2', stripe: '#d8cdbb', none: '#ffffff' }, wet: { bath: '#f8f8f6', shower: '#dfe9ee' }
};
export const STYLES = {
  smelis: { paint: 'chalk', floor: 'oak', tile: 'porcelain', wood: 'oak', fabric: 'oat', fronts: 'white', worktop: 'quartz', metal: 'brass', light: 'globe', rug: 'wool', sofa: 'debesis', table: 'rect' },
  akmuo: { paint: 'stone', floor: 'smoked', tile: 'slate', wood: 'walnut', fabric: 'charcoal', fronts: 'navy', worktop: 'black', metal: 'black', light: 'cone', rug: 'stripe', sofa: 'pilis', table: 'rect' },
  miskas: { paint: 'sage', floor: 'chevron', tile: 'zellige', wood: 'ash', fabric: 'moss', fronts: 'sage', worktop: 'oak', metal: 'brass', light: 'globe', rug: 'stripe', sofa: 'debesis', table: 'round' },
  molis: { paint: 'clay', floor: 'micro', tile: 'terrazzo', wood: 'walnut', fabric: 'rust', fronts: 'oak', worktop: 'terrazzo', metal: 'black', light: 'linear', rug: 'wool', sofa: 'pilis', table: 'round' }
};
const UP = { floor: { oak: 0, chevron: 28, smoked: 12, micro: 45 }, tile: { porcelain: 0, terrazzo: 85, zellige: 140, slate: 60 }, fronts: { white: 0, sage: 650, navy: 650, oak: 1900 }, worktop: { quartz: 0, black: 350, oak: 800, terrazzo: 1200 }, metal: { chrome: 0, black: 280, brass: 520 }, light: { spots: 0, globe: 240, cone: 280, linear: 320 } };
const FURN = { sofa: { debesis: 3900, pilis: 3400 }, bed: 2690, ctable: 890, table: 1290, chair: 390, desk: 980, side: 340, rug: 690, lamp: 420, art: 180 };
const ACCENT = { oat: 0xa65a3a, moss: 0xd9cfbd, rust: 0xe3d8c6, charcoal: 0xa65a3a, sky: 0xe3d8c6 };
const WOOD = { oak: { rot: PI / 2, rough: .62, tint: 0xffffff }, ash: { rot: 0, rough: .66, tint: 0xfffdf8 }, walnut: { rot: PI / 2, rough: .5, tint: 0x8c7d74 } };
const BEH = { bed: 'short', wc: 'short', sofa: 'long', wardrobe: 'long', desk: 'long', kitchen: 'long', sink: 'long', bath: 'long', side: 'any', shower: 'any' };
const LOOSE = new Set(['sofa', 'bed', 'side', 'rug', 'ctable', 'table', 'desk', 'plant']);
const BLOCK = new Set(['sofa', 'bed', 'table', 'kitchen', 'island', 'wardrobe', 'desk', 'bath', 'wc', 'sink', 'ctable', 'side']);

export function createInterior(renderer) {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfd8de);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  scene.environmentIntensity = .5;
  const cam = new THREE.PerspectiveCamera(60, 1, .04, 260); cam.rotation.order = 'YXZ';
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6); sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .035; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xe2eaf4, 0x9a8f80, .38); scene.add(hemi);

  /* ---------------- textures ---------------- */
  const tl = new THREE.TextureLoader(); const tp = {};
  const tex = (f, srgb) => tp[f] || (tp[f] = new Promise(res => tl.load(A(f), t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; res(t); }, undefined, () => res(null))));
  const woodTex = w => Promise.all([tex(`tex/${w}_d1.webp`, 1), tex(`tex/${w}_r.webp`), tex(`tex/${w}_n.webp`)]).then(([map, rough, nor]) => ({ map, rough, nor }));
  let rs = 1; const seed = s => { rs = s % 2147483646 + 1; }; const rnd = () => (rs = rs * 16807 % 2147483647) / 2147483647;
  const CT = (size, cover, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; t.repeat.set(1 / cover, 1 / cover); return t; };
  const noise = (g, s, amp) => { const d = g.getImageData(0, 0, s, s); for (let i = 0; i < d.data.length; i += 4) { const n = (rnd() - .5) * amp; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } g.putImageData(d, 0, 0); };
  const wrap9 = (s, f) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) f(ox, oy); };
  const grainH = img => { const c = document.createElement('canvas'); c.width = img.height; c.height = img.width; const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(PI / 2); g.drawImage(img, -img.width / 2, -img.height / 2); return c; };
  const fabricBump = CT(256, 1, (g, s) => { const d = g.createImageData(s, s); seed(3); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const w = ((x >> 1) + (y >> 1)) & 1; const v = 150 + (w ? 40 : -10) + rnd() * 40; const i = (y * s + x) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }, false);
  fabricBump.repeat.set(9, 9);

  let oakSrc = null; const FT = {};
  function floorTex(kind) {
    if (FT[kind]) return FT[kind];
    const S = LOW ? 1024 : 2048, src = oakSrc;
    if (kind === 'micro') return FT[kind] = CT(S / 2, 3, (g, s) => { g.fillStyle = '#bcb5a9'; g.fillRect(0, 0, s, s); seed(5);
      for (let i = 0; i < 220; i++) { const x = rnd() * s, y = rnd() * s, r = 20 + rnd() * s * .16, l = rnd() < .5; wrap9(s, (ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, l ? 'rgba(255,255,255,.07)' : 'rgba(70,60,50,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); }); }
      noise(g, s, 10); });
    if (kind === 'chevron') { const cols = 8, cwM = .38, C = cols * cwM, rows = 22; return FT[kind] = CT(S, C, (g, s) => {
      const px = s / C, cw = cwM * px, p = s / rows, k = .55;
      for (let c = 0; c < cols; c++) { const x0 = c * cw, x1 = x0 + cw, sg = c % 2 ? 1 : -1;
        for (let r = -3; r < rows + 3; r++) { const y0 = r * p; seed(1000 + c * 97 + (((r % rows) + rows) % rows) * 13);
          const pts = sg > 0 ? [[x0, y0], [x1, y0 + cw], [x1, y0 + cw + p], [x0, y0 + p]] : [[x0, y0 + cw], [x1, y0], [x1, y0 + p], [x0, y0 + cw + p]];
          g.save(); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
          g.translate((x0 + x1) / 2, y0 + p / 2 + cw / 2); g.rotate(sg * PI / 4);
          const L = cw * 1.6, Wd = p * 1.6; g.drawImage(src, rnd() * (src.width - L * k), rnd() * (src.height - Wd * k), L * k, Wd * k, -L / 2, -Wd / 2, L, Wd);
          g.fillStyle = `rgba(${rnd() < .5 ? '60,40,20' : '255,240,220'},${rnd() * .09})`; g.fillRect(-L, -L, 2 * L, 2 * L); g.restore();
          g.strokeStyle = 'rgba(45,30,18,.42)'; g.lineWidth = 1.4; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke(); } } }); }
    // planks (oak / smoked)
    const C = 3.6; return FT[kind] = CT(S, C, (g, s) => { const px = s / C, rows = Math.round(C / .2), h = s / rows; seed(kind === 'oak' ? 3 : 9);
      for (let r = 0; r < rows; r++) { const lens = []; let sum = 0; while (sum < s) { const l = (1.1 + rnd() * 1.1) * px; lens.push(l); sum += l; } const sc = s / sum; let x = rnd() * s; const y = r * h;
        for (const l0 of lens) { const len = l0 * sc, k = Math.min(.62, (src.width - 2) / len); const sx = rnd() * Math.max(1, src.width - len * k), sy = rnd() * Math.max(1, src.height - h * k), tone = rnd(), dark = rnd() < .5;
          for (const ox of [0, -s]) { g.drawImage(src, sx, sy, len * k, h * k, x + ox, y, len, h); g.fillStyle = `rgba(${dark ? '60,40,20' : '255,240,220'},${tone * .09})`; g.fillRect(x + ox, y, len, h); g.fillStyle = 'rgba(40,28,18,.5)'; g.fillRect(x + ox, y, 1.6, h); }
          x = (x + len) % s; }
        g.fillStyle = 'rgba(40,28,18,.45)'; g.fillRect(0, y, s, 1.3); }
      if (kind === 'smoked') { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#8b7461'; g.fillRect(0, 0, s, s); g.globalCompositeOperation = 'source-over'; } });
  }
  const TT = {};
  function tileTex(kind) {
    if (TT[kind]) return TT[kind];
    const S = LOW ? 512 : 1024;
    if (kind === 'porcelain') return TT[kind] = CT(S, 1.2, (g, s) => { g.fillStyle = '#e6e2db'; g.fillRect(0, 0, s, s); seed(11); noise(g, s, 7); g.fillStyle = '#c9c2b7'; for (let i = 0; i < 2; i++) { g.fillRect(i * s / 2 - 1, 0, 2.4, s); g.fillRect(0, i * s / 2 - 1, s, 2.4); } });
    if (kind === 'terrazzo') return TT[kind] = CT(S, 1.2, (g, s) => { g.fillStyle = '#ece5d9'; g.fillRect(0, 0, s, s); seed(12); const cols = ['#b45f3c', '#7d8a6e', '#3c3b39', '#d4bf9c', '#9aa7ad', '#c98d6e'];
      for (let i = 0; i < 1100; i++) { const x = rnd() * s, y = rnd() * s, r = 1.5 + rnd() ** 2 * 11, c = cols[(rnd() * cols.length) | 0], n = 5 + (rnd() * 3 | 0), a0 = rnd() * 6;
        wrap9(s, (ox, oy) => { g.fillStyle = c; g.beginPath(); for (let k = 0; k < n; k++) { const a = a0 + k / n * PI * 2, rr = r * (.6 + rnd() * .5); k ? g.lineTo(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr) : g.moveTo(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr); } g.fill(); }); }
      noise(g, s, 6); g.fillStyle = 'rgba(150,140,125,.5)'; for (let i = 0; i < 2; i++) { g.fillRect(i * s / 2 - 1, 0, 2, s); g.fillRect(0, i * s / 2 - 1, s, 2); } });
    if (kind === 'zellige') return TT[kind] = CT(S, .6, (g, s) => { g.fillStyle = '#e1dccf'; g.fillRect(0, 0, s, s); seed(13); const n = 6, t = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const l = 24 + rnd() * 12, x = i * t + 2, y = j * t + 2, w = t - 4; g.fillStyle = `hsl(${158 + rnd() * 8},${34 + rnd() * 10}%,${l}%)`; g.fillRect(x, y, w, w);
        const gr = g.createRadialGradient(x + w * (.2 + rnd() * .6), y + w * (.2 + rnd() * .6), 0, x + w / 2, y + w / 2, w * .8); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, w, w); }
      noise(g, s, 8); });
    return TT[kind] = CT(S, 1.2, (g, s) => { g.fillStyle = '#353837'; g.fillRect(0, 0, s, s); seed(14); const rh = s / 4, cw = s / 2;
      for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) { const x = c * cw + (r % 2 ? cw / 2 : 0); g.fillStyle = `hsl(150,3%,${26 + rnd() * 7}%)`; g.fillRect(x + 1.5, r * rh + 1.5, cw - 3, rh - 3); }
      noise(g, s, 14); });
  }
  const quartz = () => TT.quartz || (TT.quartz = CT(LOW ? 512 : 1024, 1.6, (g, s) => { g.fillStyle = '#f2f0eb'; g.fillRect(0, 0, s, s); seed(21); noise(g, s, 4);
    for (let i = 0; i < 14; i++) { let x = rnd() * s, y = rnd() * s; g.strokeStyle = `rgba(120,115,110,${.05 + rnd() * .08})`; g.lineWidth = .6 + rnd() * 1.6; wrap9(s, (ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.bezierCurveTo(x + ox + rnd() * 300 - 150, y + oy + rnd() * 300, x + ox + rnd() * 400 - 200, y + oy + rnd() * 400, x + ox + rnd() * 500 - 250, y + oy + 400); g.stroke(); }); } }));
  const rugTex = { wool: CT(512, 1.4, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); seed(31); noise(g, s, 40); }),
    stripe: CT(512, 2.4, (g, s) => { g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, s, s); seed(32); noise(g, s, 18); g.strokeStyle = '#3b3733'; g.lineWidth = 5;
      for (let i = 0; i < 8; i++) { const y = i * s / 8 + s / 16; g.beginPath(); for (let x = 0; x <= s; x += s / 16) g.lineTo(x, y + ((x / (s / 16)) % 2 ? 14 : -14)); g.stroke(); } }) };
  const leafTex = CT(256, 1, (g, s) => { g.clearRect(0, 0, s, s); const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#5f8a3f'); gr.addColorStop(1, '#2f5a2b'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(s / 2, s * .98); g.bezierCurveTo(s * .02, s * .7, s * .08, s * .18, s / 2, s * .02); g.bezierCurveTo(s * .92, s * .18, s * .98, s * .7, s / 2, s * .98); g.fill();
    g.strokeStyle = 'rgba(200,230,170,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(s / 2, s * .96); g.lineTo(s / 2, s * .06); g.stroke(); g.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) { const y = s * (.15 + i * .1); g.beginPath(); g.moveTo(s / 2, y); g.quadraticCurveTo(s * .3, y - 20, s * .18, y - 34); g.moveTo(s / 2, y); g.quadraticCurveTo(s * .7, y - 20, s * .82, y - 34); g.stroke(); } });
  leafTex.repeat.set(1, 1); leafTex.wrapS = leafTex.wrapT = THREE.ClampToEdgeWrapping;

  /* ---------------- materials ---------------- */
  const std = o => new THREE.MeshStandardMaterial(o);
  const M = {
    core: std({ color: 0xf3f1ec, roughness: .92 }), ceil: std({ color: 0xf7f6f3, roughness: .95, shadowSide: THREE.DoubleSide }),
    skirt: std({ color: 0xf4f2ee, roughness: .45 }), floor: std({ roughness: .55 }), tile: std({ roughness: .35 }),
    frame: std({ color: 0x2c2e30, roughness: .45, metalness: .5 }),
    glass: std({ color: 0xdfe9ee, roughness: .04, metalness: .1, transparent: true, opacity: .12, depthWrite: false }),
    door: std({ color: 0xf2f0eb, roughness: .42 }), entry: std({ color: 0x8a7f73, roughness: .5 }),
    wood: std({ roughness: .62 }), woodH: std({ roughness: .62 }),
    fabric: new (LOW ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial)({ color: 0xd9cfbd, roughness: .95, bumpMap: fabricBump, bumpScale: .6, ...(LOW ? {} : { sheen: .6, sheenRoughness: .8, sheenColor: new THREE.Color(0xffffff) }) }),
    linen: std({ color: 0xf1eee8, roughness: .95, bumpMap: fabricBump, bumpScale: .4 }), accent: std({ color: 0xa65a3a, roughness: .95, bumpMap: fabricBump, bumpScale: .5 }),
    ceramic: std({ color: 0xece6da, roughness: .5 }), porcelain: std({ color: 0xf8f8f6, roughness: .1 }),
    metal: std({ color: 0xb48f55, roughness: .28, metalness: .9 }), hob: std({ color: 0x0f0f10, roughness: .06, metalness: .3 }), ring: std({ color: 0x3c3c3c, roughness: .5 }),
    steel: std({ color: 0x9a9da0, roughness: .32, metalness: .85 }), sinkIn: std({ color: 0x6f7275, roughness: .35, metalness: .85 }),
    fronts: std({ color: 0xefede8, roughness: .5 }), carcass: std({ color: 0xe9e6e0, roughness: .7 }), worktop: std({ roughness: .3 }), plinth: std({ color: 0x26262a, roughness: .7 }),
    glassS: std({ color: 0xeef4f5, roughness: .03, metalness: .1, transparent: true, opacity: .16, depthWrite: false }),
    mirror: std({ color: 0xffffff, roughness: .02, metalness: 1 }), led: std({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: .3 }),
    opal: std({ color: 0xf6f2ea, emissive: 0xffe2b8, emissiveIntensity: .12, roughness: .5 }), spot: std({ color: 0xf5f5f5, emissive: 0xfff0d6, emissiveIntensity: .25, roughness: .4 }),
    shade: std({ color: 0xefe8dc, emissive: 0xffd59a, emissiveIntensity: 0, roughness: .9, side: THREE.DoubleSide }), cord: std({ color: 0x1b1b1b, roughness: .6 }),
    leaf: std({ map: leafTex, alphaTest: .5, side: THREE.DoubleSide, roughness: .65 }), stem: std({ color: 0x3e4d2c, roughness: .9 }),
    pot: std({ color: 0xb8704e, roughness: .85 }), soil: std({ color: 0x3a2c22, roughness: 1 }),
    rug: std({ roughness: 1 }), mat: std({ color: 0x4b4540, roughness: 1 }),
    curtain: std({ color: 0xf3efe7, roughness: 1, transparent: true, opacity: .9, side: THREE.DoubleSide }),
    frameB: std({ color: 0x1d1d1d, roughness: .5 }), pass: std({ color: 0xf6f4ef, roughness: .9 }),
    art1: std({ roughness: .8 }), art2: std({ roughness: .8 }), deck: std({ roughness: .8 }),
    rail: std({ color: 0xcfe0e4, roughness: .05, transparent: true, opacity: .25, depthWrite: false }),
    fruit: [0xe0892f, 0x9bb24a, 0xd9c14a].map(c => std({ color: c, roughness: .55 })),
    book: [0x7b8a74, 0xc9b79c, 0x3e4a56, 0xa65a3a, 0xe2ddd2, 0x5b4637].map(c => std({ color: c, roughness: .8 })),
    paint: []
  };
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(130, 64), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }));
  scene.add(backdrop);

  /* ---------------- geometry helpers ---------------- */
  const worldUV = (g, w, h, d, k = 1.1) => { const n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let su, sv;
      if (ax >= ay && ax >= az) { su = d; sv = h; } else if (ay >= az) { su = w; sv = d; } else { su = w; sv = h; }
      uv.setXY(i, uv.getX(i) * su / k + w * .37, uv.getY(i) * sv / k + d * .53); } return g; };
  const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
  const B = (w, h, d, m = M.woodH, r = .004) => { const rr = Math.min(r, w / 2.2, h / 2.2, d / 2.2); const g = rr > .0008 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d); return mesh(worldUV(g, w, h, d), m); };
  const V = (w, h, d, r) => B(w, h, d, M.wood, r);
  const at = (o, x, y, z, ry = 0, rx = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
  const cyl = (rt, rb, h, m, seg = 24, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m);
  const lathe = (pts, m, seg = 32) => mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), m);
  const tube = (pts, r, m, seg = 24) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 8), m);
  const taper = (top, bot, h, m = M.wood) => { const g = worldUV(new RoundedBoxGeometry(top, h, top, 2, .003), top, h, top), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = (p.getY(i) + h / 2) / h, s = (bot + (top - bot) * k) / top; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); } g.computeVertexNormals(); return mesh(g, m); };
  const legs4 = (g, x, z, h, top = .045, bot = .03, splay = .04, m = M.wood) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = taper(top, bot, h, m); at(l, sx * x, h / 2, sz * z, 0, sz * splay * .7, -sx * splay); g.add(l); } };
  const cushion = (w, h, d, r = .05, m = M.fabric) => B(w, h, d, m, r);
  const se = (rx, ry, n = 64, p = 3.2) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * PI * 2, c = Math.cos(a), s = Math.sin(a); pts.push(new THREE.Vector2(rx * Math.sign(c) * Math.abs(c) ** (2 / p), ry * Math.sign(s) * Math.abs(s) ** (2 / p))); } return pts; };

  // merge a built group into one mesh per material (keeps draw calls low while walking)
  function bake(g) {
    g.updateMatrixWorld(true); const by = new Map();
    g.traverse(o => { if (!o.isMesh) return; let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.normal) geo.computeVertexNormals(); if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      geo.morphAttributes = {}; const e = by.get(o.material) || by.set(o.material, { list: [], cast: false, ro: o.renderOrder }).get(o.material); e.list.push(geo); e.cast ||= o.castShadow; });
    g.traverse(o => o.geometry?.dispose());
    const out = new THREE.Group();
    for (const [m, e] of by) { const mm = new THREE.Mesh(mg0(e.list), m); e.list.forEach(x => x.dispose()); mm.castShadow = e.cast && !m.transparent; mm.receiveShadow = !m.transparent; mm.renderOrder = e.ro || (m.transparent ? 2 : 0); out.add(mm); }
    return out;
  }
  const dispose = g => g && g.traverse(o => o.geometry?.dispose());

  /* ---------------- state ---------------- */
  const D = { style: 'smelis', evening: false, furnish: true, wet: 'bath' };
  let P = null, unit = null, rooms = [], ops = [], items = [], fixtures = [], lights = [], shell = null, outside = null, solid = [], kitchenRuns = 0;
  const roomAt = (x, z, e = .001) => rooms.find(r => x >= r.x0 - e && x <= r.x1 + e && z >= r.z0 - e && z <= r.z1 + e) || null;
  const isExtH = c => c < 1e-3 || Math.abs(c - P.D) < 1e-3, isExtV = c => c < 1e-3 || Math.abs(c - P.W) < 1e-3;
  const union = l => { l.sort((a, b) => a[0] - b[0]); const o = []; for (const s of l) { const t = o[o.length - 1]; if (t && s[0] <= t[1] + 1e-3) t[1] = Math.max(t[1], s[1]); else o.push([...s]); } return o; };
  const cutOut = (segs, holes) => { let out = segs; for (const [a, b] of holes) { const n = []; for (const [s, e] of out) { if (b <= s + 1e-4 || a >= e - 1e-4) n.push([s, e]); else { if (a > s) n.push([s, a]); if (b < e) n.push([b, e]); } } out = n; } return out.filter(([s, e]) => e - s > .02); };

  function applyStyle(name) { const s = STYLES[name]; Object.assign(D, { style: name, floor: s.floor, tile: s.tile, wood: s.wood, fabric: s.fabric, fronts: s.fronts, worktop: s.worktop, metal: s.metal, sofa: s.sofa, table: s.table, rug: s.rug });
    D.paint = rooms.map(() => s.paint); D.light = rooms.map(r => r.wet || r.key === 'hall' ? 'spots' : s.light); }

  /* ---------------- shell: walls, floors, ceilings, windows, doors ---------------- */
  function buildShell() {
    const g = new THREE.Group(); solid = [];
    const k = n => Math.round(n * 1000) / 1000;
    const H = new Map(), Vt = new Map(); const push = (map, key, a, b) => (map.get(key) || map.set(key, []).get(key)).push([Math.min(a, b), Math.max(a, b)]);
    for (const r of rooms) { push(H, k(r.z0), r.x0, r.x1); push(H, k(r.z1), r.x0, r.x1); push(Vt, k(r.x0), r.z0, r.z1); push(Vt, k(r.x1), r.z0, r.z1); }
    const box = (w, h, d, x, y, z, m = M.core) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
    const addSolid = (x0, z0, x1, z1) => solid.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
    const lines = [...[...H].map(([c, l]) => ({ h: true, c, l })), ...[...Vt].map(([c, l]) => ({ h: false, c, l }))];
    for (const { h, c, l } of lines) {
      const ext = h ? isExtH(c) : isExtV(c), th = ext ? TE : TI, on = ops.filter(o => o.h === h && Math.abs(o.c - c) < 1e-3);
      const put = (a, b, y0, y1) => { const len = b - a, mid = (a + b) / 2; h ? box(len, y1 - y0, th, mid, (y0 + y1) / 2, c) : box(th, y1 - y0, len, c, (y0 + y1) / 2, mid); };
      for (const [a0, b0] of union(l)) {
        if (h && c < 1e-3) { put(a0 - th / 2, b0 + th / 2, WT, WH); put(a0, b0, 0, .03); addSolid(a0, c - th / 2, b0, c + th / 2); continue; }
        for (let [a, b] of cutOut([[a0, b0]], on.map(o => [o.a, o.b]))) { const e0 = on.some(o => Math.abs(o.b - a) < 1e-3) ? 0 : th / 2, e1 = on.some(o => Math.abs(o.a - b) < 1e-3) ? 0 : th / 2; a -= e0; b += e1;
          put(a, b, 0, WH); h ? addSolid(a, c - th / 2, b, c + th / 2) : addSolid(c - th / 2, a, c + th / 2, b); }
        for (const o of on) if (o.kind !== 'open' && o.a >= a0 - 1e-3 && o.b <= b0 + 1e-3) { put(o.a, o.b, DH, WH); if (o.kind === 'entry') h ? addSolid(o.a, c - th / 2, o.b, c + th / 2) : addSolid(c - th / 2, o.a, c + th / 2, o.b); }
      }
    }
    // per-room linings, floors, ceilings, skirting, windows, curtains
    const pieces = new Map();
    for (const r of rooms) {
      const wallM = r.wet ? M.tile : M.paint[r.i];
      const fl = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0); fl.rotateX(-PI / 2); fl.translate(r.cx, 0, r.cz);
      const p = fl.attributes.position, uv = fl.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
      g.add(mesh(fl, r.wet ? M.tile : M.floor, false));
      const ce = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0); ce.rotateX(PI / 2); ce.translate(r.cx, WH, r.cz); const cm = mesh(ce, M.ceil, true); cm.userData.ceil = 1; g.add(cm);
      const edges = [{ h: true, c: r.z0, a: r.x0, b: r.x1, n: 1 }, { h: true, c: r.z1, a: r.x0, b: r.x1, n: -1 }, { h: false, c: r.x0, a: r.z0, b: r.z1, n: 1 }, { h: false, c: r.x1, a: r.z0, b: r.z1, n: -1 }];
      for (const e of edges) {
        const ext = e.h ? isExtH(e.c) : isExtV(e.c), off = (ext ? TE : TI) / 2 + .004, lim = e.h ? P.W : P.D;
        const ea = (e.a < 1e-3 || Math.abs(e.a - lim) < 1e-3 ? TE : TI) / 2, eb = (e.b < 1e-3 || Math.abs(e.b - lim) < 1e-3 ? TE : TI) / 2;
        const a = e.a + ea, b = e.b - eb, on = ops.filter(o => o.h === e.h && Math.abs(o.c - e.c) < 1e-3 && o.b > a && o.a < b);
        const plane = (pa, pb, y0, y1, m) => { const len = pb - pa, hh = y1 - y0; if (len < .02 || hh < .01) return; const pg = new THREE.PlaneGeometry(len, hh); const pp = pg.attributes.position, pu = pg.attributes.uv;
          for (let i = 0; i < pp.count; i++) pu.setXY(i, pa + pp.getX(i) + len / 2, y0 + pp.getY(i) + hh / 2);
          const o = mesh(pg, m, false), mid = (pa + pb) / 2, y = (y0 + y1) / 2;
          if (e.h) at(o, mid, y, e.c + e.n * off, e.n > 0 ? 0 : PI); else at(o, e.c + e.n * off, y, mid, e.n > 0 ? PI / 2 : -PI / 2); g.add(o); };
        const skirt = (pa, pb) => { if (r.wet || pb - pa < .05) return; const len = pb - pa, mid = (pa + pb) / 2, o = mesh(new THREE.BoxGeometry(len, .075, .014), M.skirt, false);
          if (e.h) at(o, mid, .0375, e.c + e.n * (off + .007), 0); else at(o, e.c + e.n * (off + .007), .0375, mid, PI / 2); g.add(o); };
        if (e.h && e.c < 1e-3) { // window wall
          plane(a, b, WT, WH, wallM);
          const len = b - a, n = Math.max(1, Math.round(len / 1.25)), fz = 0;
          const gl = mesh(new THREE.PlaneGeometry(len, WT - .04), M.glass, false); at(gl, (a + b) / 2, .04 + (WT - .04) / 2, fz); gl.renderOrder = 3; g.add(gl);
          const fr = (w, hh, x, y) => { const o = mesh(new THREE.BoxGeometry(w, hh, .09), M.frame); at(o, x, y, fz + .01); g.add(o); };
          fr(len, .06, (a + b) / 2, WT - .03); fr(len, .05, (a + b) / 2, .055); fr(.06, WT, a + .03, WT / 2); fr(.06, WT, b - .03, WT / 2);
          for (let i = 1; i < n; i++) fr(.05, WT, a + i * len / n, WT / 2);
          fr(len, .04, (a + b) / 2, 2.12); // transom: opening top lights
          if (!r.wet && r.key !== 'hall' && len > 1.4) { // sheer curtains + track
            const tz = TE / 2 + .12, trk = mesh(new THREE.BoxGeometry(len - .1, .025, .035), M.skirt, false); at(trk, (a + b) / 2, WH - .1, tz); g.add(trk);
            for (const [cx, w] of [[a + .34, .56], [b - .34, .56]]) { const cg = new THREE.PlaneGeometry(w, WH - .16, 28, 1), cp = cg.attributes.position;
              for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin((cp.getX(i) / w + .5) * PI * 9) * .035); cg.computeVertexNormals(); const cu = mesh(cg, M.curtain, false); at(cu, cx, (WH - .16) / 2 + .02, tz + .02); cu.renderOrder = 2; g.add(cu); }
          }
          continue;
        }
        const full = cutOut([[a, b]], on.map(o => [o.a, o.b]));
        for (const [pa, pb] of full) { plane(pa, pb, 0, WH, wallM); skirt(pa, pb); }
        for (const o of on) if (o.kind !== 'open') plane(Math.max(o.a, a), Math.min(o.b, b), DH, WH, wallM);
      }
    }
    // doors
    for (const o of ops) if (o.kind !== 'open') g.add(doorFor(o));
    const bg = bake(g); bg.traverse(m => { if (m.isMesh && m.material === M.ceil) m.userData.ceil = 1; });
    return bg;
  }
  function doorFor(o) {
    const g = new THREE.Group(), th = o.kind === 'entry' ? TE : TI, L = o.len, mid = (o.a + o.b) / 2;
    const side = s => o.h ? roomAt(mid, o.c + s * .4) : roomAt(o.c + s * .4, mid);
    const r1 = side(1), r0 = side(-1); let sd = 1;
    if (!r1) sd = -1; else if (r0) { const h1 = r1.key === 'hall', h0 = r0.key === 'hall'; sd = h1 && !h0 ? -1 : h0 && !h1 ? 1 : (r1.area <= r0.area ? 1 : -1); }
    // local frame: x along the opening, z across (sd side positive)
    for (const s of [-1, 1]) g.add(at(B(.035, DH, th + .03, M.door, .002), s * (L / 2 - .0175), DH / 2, 0));
    g.add(at(B(L, .035, th + .03, M.door, .002), 0, DH - .0175, 0));
    if (o.kind === 'door') {
      const lw = L - .08; g.add(at(B(.04, DH - .05, lw, M.door, .004), -L / 2 + .055, (DH - .05) / 2 + .01, (th / 2 + lw / 2 + .01)));
      for (const s of [-1, 1]) g.add(at(B(.022, .02, .13, M.metal, .006), -L / 2 + .055 + s * .035, 1.02, th / 2 + lw - .08));
      g.add(at(B(.085, .085, .012, M.skirt, .003), L / 2 + .16, 1.05, th / 2 + .01));
    } else if (o.kind === 'entry') {
      g.add(at(B(L - .07, DH - .05, .06, M.entry, .004), 0, (DH - .05) / 2 + .01, 0));
      for (const s of [-1, 1]) g.add(at(B(.13, .02, .022, M.metal, .006), L / 2 - .14, 1.02, s * .045));
      g.add(at(cyl(.012, .012, .07, M.metal, 12), 0, 1.55, 0, 0, PI / 2));
      g.add(at(B(.8, .012, .5, M.mat, .004), 0, .006, -.42)); // doormat inside
      g.add(at(B(.085, .085, .012, M.skirt, .003), -L / 2 - .16, 1.05, -th / 2 - .01));
    }
    if (o.h) { g.position.set(mid, 0, o.c); g.rotation.y = o.kind === 'entry' ? (o.c > 1e-3 ? 0 : PI) : (sd < 0 ? PI : 0); }
    else { g.position.set(o.c, 0, mid); g.rotation.y = o.kind === 'entry' ? (o.c > 1e-3 ? -PI / 2 : PI / 2) : (sd > 0 ? PI / 2 : -PI / 2); }
    return g;
  }

  /* ---------------- items ---------------- */
  function orient(kind, x, z, w, d, r) {
    const cx = x + w / 2, cz = z + d / 2, beh = BEH[kind];
    if (!beh || !r) return { cx, cz, rotY: 0, W: w, Dp: d, gap: 0, wall: .3 };
    const dist = { '-z': z - r.z0, '+z': r.z1 - (z + d), '-x': x - r.x0, '+x': r.x1 - (x + w) };
    let cand = Object.keys(dist); const longX = w >= d;
    if (beh === 'long') cand = longX ? ['-z', '+z'] : ['-x', '+x']; if (beh === 'short') cand = longX ? ['-x', '+x'] : ['-z', '+z'];
    const back = cand.reduce((m, k) => dist[k] < dist[m] ? k : m);
    const rotY = { '-z': 0, '+z': PI, '-x': PI / 2, '+x': -PI / 2 }[back], along = back[1] === 'z';
    const c = { '-z': r.z0, '+z': r.z1, '-x': r.x0, '+x': r.x1 }[back], ext = along ? isExtH(c) : isExtV(c);
    return { cx, cz, rotY, W: along ? w : d, Dp: along ? d : w, gap: dist[back], wall: Math.max(0, dist[back] - (ext ? TE : TI) / 2 - .004), back };
  }
  function ctxFor(o) { const c = Math.cos(o.rotY), s = Math.sin(o.rotY);
    return { wall: o.wall, glass: o.back === '-z' && roomAt(o.cx, o.cz)?.z0 < 1e-3, fits: (lx, lz, m = .15) => { const x = o.cx + lx * c + lz * s, z = o.cz - lx * s + lz * c, r = roomAt(x, z); return !!r && x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m && !items.some(it => it.block && it.rect && x > it.rect[0] && x < it.rect[2] && z > it.rect[1] && z < it.rect[3]); } }; }

  const art = (m, w, h) => { const g = new THREE.Group(); g.add(at(B(w, h, .03, M.frameB, .003), 0, 0, 0)); const pp = mesh(new THREE.PlaneGeometry(w - .04, h - .04), M.pass, false); at(pp, 0, 0, .0155); g.add(pp);
    const pr = mesh(new THREE.PlaneGeometry(w - .2, h - .2), m, false); at(pr, 0, 0, .0165); g.add(pr); return g; };
  const B3 = {
    sofa(W, Dp, x) {
      const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
      const Dd = Math.min(1.0, Math.max(.86, Dp)); inner.position.z = -Dp / 2 + Dd / 2;
      if (D.sofa === 'pilis') {
        inner.add(at(B(W - .06, .07, Dd - .06, M.plinth, .005), 0, .035, 0)); inner.add(at(cushion(W, .25, Dd, .035), 0, .195, 0));
        for (const sx of [-1, 1]) inner.add(at(cushion(.22, .32, Dd, .07), sx * (W / 2 - .11), .32 + .14, 0));
        inner.add(at(cushion(W - .44, .44, .24, .06), 0, .32 + .22, -Dd / 2 + .12));
        const n = W > 1.9 ? 3 : 2, cw = (W - .44) / n;
        for (let i = 0; i < n; i++) { const cx = -W / 2 + .22 + cw * (i + .5); inner.add(at(cushion(cw - .01, .13, Dd - .26, .055), cx, .385, .12)); inner.add(at(cushion(cw - .02, .42, .17, .07), cx, .62, -Dd / 2 + .32, 0, -.16)); }
      } else {
        const base = .2; inner.add(at(B(W, .06, Dd, M.woodH, .01), 0, base + .03, 0)); legs4(inner, W / 2 - .08, Dd / 2 - .08, base, .045, .035, .02);
        for (const sx of [-1, 1]) inner.add(at(B(.06, .42, Dd, M.woodH, .015), sx * (W / 2 - .03), base + .27, 0));
        inner.add(at(B(W - .12, .38, .1, M.woodH, .01), 0, base + .25, -Dd / 2 + .05));
        const n = W > 1.7 ? 3 : 2, cw = (W - .14) / n;
        for (let i = 0; i < n; i++) { const cx = -W / 2 + .07 + cw * (i + .5); inner.add(at(cushion(cw - .01, .17, Dd - .16, .06), cx, base + .145, .05)); inner.add(at(cushion(cw - .02, .44, .16, .07), cx, base + .43, -Dd / 2 + .17, 0, -.18)); }
      }
      for (const sx of [-1, 1]) inner.add(at(cushion(.42, .4, .13, .06, M.accent), sx * (W / 2 - .42), .62, -Dd / 2 + .34, 0, -.28, sx * .12));
      // throw over one arm
      inner.add(at(cushion(.34, .02, .7, .01, M.linen), -W / 2 + .2, .52, .05, 0, 0, .05));
      if (x.fits(W / 2 + .32, -Dp / 2 + .25)) { // arc floor lamp
        const lx = W / 2 + .32, lz = -Dp / 2 + .25; g.add(at(cyl(.17, .18, .03, M.ceramic, 32), lx, .015, lz)); g.add(at(cyl(.011, .011, 1.6, M.metal, 10), lx, .83, lz));
        g.add(tube([[lx, 1.6, lz], [lx - .05, 1.9, lz + .12], [lx - .4, 2.0, lz + .32], [W / 2 - .35, 1.86, .1]], .011, M.metal));
        const sh = lathe([[0, 0], [.03, .01], [.15, .1], [.19, .2], [.185, .205], [.02, .03]], M.metal); at(sh, W / 2 - .35, 1.62, .1); g.add(sh);
        g.add(at(cyl(.15, .15, .01, M.opal, 24), W / 2 - .35, 1.63, .1));
      }
      if (x.wall < 1 && !x.glass) { const a = art(M.art1, Math.min(1.1, W * .5), Math.min(1.1, W * .5) * .74); at(a, 0, 1.5, -Dp / 2 - x.wall + .016); g.add(a); }
      return g;
    },
    bed(W, Dp, x) {
      const g = new THREE.Group(), fw = W, fl = Dp - .06, rh = .3, z0 = .03;
      for (const sx of [-1, 1]) g.add(at(B(.04, .18, fl, M.woodH), sx * (fw / 2 - .02), rh, z0));
      g.add(at(B(fw, .18, .04, M.woodH), 0, rh, z0 + fl / 2 - .02)); legs4(g, fw / 2 - .05, fl / 2 - .06, rh - .09, .06, .05, 0); g.children.slice(-4).forEach(l => l.position.z += z0);
      const hb = .98, n = Math.round(fw / .105); for (let i = 0; i < n; i++) g.add(at(B(fw / n - .012, hb - .2, .03, M.wood, .006), -fw / 2 + fw / n * (i + .5), .2 + (hb - .2) / 2, -Dp / 2 + .03));
      g.add(at(B(fw + .04, .04, .06, M.woodH, .01), 0, hb + .02, -Dp / 2 + .03));
      const mw = W - .1, ml = fl - .06; g.add(at(cushion(mw, .22, ml, .05, M.linen), 0, rh + .13, z0));
      g.add(at(cushion(mw + .06, .07, ml * .64, .035, M.linen), 0, rh + .26, z0 + ml * .18));
      g.add(at(cushion(mw + .08, .04, .55, .02), 0, rh + .3, z0 + ml / 2 - .32));
      const np = W > 1.25 ? 2 : 1; for (let i = 0; i < np; i++) { const px = np === 1 ? 0 : (i ? 1 : -1) * mw / 4.3; g.add(at(B(np === 1 ? mw * .7 : mw / 2 - .06, .15, .42, M.linen, .045), px, rh + .34, -Dp / 2 + .3, 0, -.45)); }
      g.add(at(cushion(.46, .13, .32, .05, M.accent), .12 * (np - 1), rh + .38, -Dp / 2 + .55, 0, -.35, .1));
      if (x.wall < 1 && !x.glass) { const a = art(M.art2, Math.min(1.2, W * .7), Math.min(1.2, W * .7) * .66); at(a, 0, 1.62, -Dp / 2 - x.wall + .016); g.add(a); }
      return g;
    },
    side(W, Dp) {
      const g = new THREE.Group(), w = Math.min(W, .48), d = Math.min(Dp, .4);
      g.add(at(B(w, .36, d, M.woodH, .006), 0, .14 + .18, 0)); legs4(g, w / 2 - .04, d / 2 - .04, .14, .03, .024, 0);
      g.add(at(B(w - .04, .004, .004, M.plinth, .001), 0, .4, d / 2 + .001));
      const base = lathe([[0, 0], [.06, 0], [.08, .07], [.06, .18], [.022, .22], [.012, .24]], M.ceramic); at(base, 0, .5, -.02); g.add(base);
      const shd = cyl(.11, .14, .19, M.shade, 32, true); at(shd, 0, .5 + .3, -.02); shd.castShadow = false; g.add(shd);
      g.add(at(B(.17, .03, .12, M.book[2], .003), .07, .515, .08, .3));
      return g;
    },
    rug(W, Dp) { const g = new THREE.Group(); if (D.rug === 'none') return g; const r = B(W, .012, Dp, M.rug, .004); r.castShadow = false; g.add(at(r, 0, .006, 0)); return g; },
    ctable(W, Dp) {
      const g = new THREE.Group(), L = W, Dd = Dp, H = .38;
      g.add(at(B(L, .035, Dd, M.woodH, .03), 0, H - .018, 0)); g.add(at(B(L - .16, .022, Dd - .14, M.woodH, .01), 0, .1, 0)); legs4(g, L / 2 - .09, Dd / 2 - .08, H - .035, .05, .04, .02);
      const bowl = lathe([[0, 0], [.06, 0], [.11, .04], [.12, .07], [.115, .07], [.1, .045], [0, .02]], M.ceramic); at(bowl, L * .22, H, -.04); g.add(bowl);
      M.book.slice(0, 3).forEach((m, i) => g.add(at(B(.24 - i * .02, .025, .17 - i * .01, m, .003), -L * .22, H + .013 + i * .026, .02, .12 * i - .1)));
      return g;
    },
    chair(fab = true) {
      const g = new THREE.Group(), sh = .45, w = .46, d = .46;
      for (const sx of [-1, 1]) { g.add(at(taper(.036, .028, sh - .02), sx * (w / 2 - .03), (sh - .02) / 2, d / 2 - .03, 0, 0, -sx * .03)); g.add(at(taper(.034, .03, .82), sx * (w / 2 - .03), .41, -d / 2 + .04, 0, -.09)); }
      g.add(at(fab ? cushion(w, .06, d, .02) : B(w, .032, d, M.woodH, .01), 0, sh, 0));
      g.add(at(B(w - .03, .09, .025, M.woodH, .008), 0, .76, -d / 2 + .02, 0, -.09));
      for (const z of [d / 2 - .03, -d / 2 + .04]) g.add(at(B(w - .07, .02, .018), 0, .16, z));
      return g;
    },
    table(W, Dp, x, n = 4) {
      const g = new THREE.Group(), H = .75;
      if (D.table === 'round') {
        const dm = Math.max(.95, Math.min(1.2, Math.min(W, Dp) + .3)), top = cyl(dm / 2, dm / 2, .035, M.woodH, 64); g.add(at(top, 0, H - .018, 0));
        g.add(at(lathe([[0, 0], [.28, 0], [.28, .02], [.07, .1], [.05, .4], [.06, .68], [.16, .7], [0, .7]], M.wood, 40), 0, 0, 0));
        const nn = Math.min(n, dm < 1.05 ? 4 : 5), Rr = dm / 2 + .12; for (let i = 0; i < nn; i++) { const a = i / nn * PI * 2 + PI / nn; const c = B3.chair(); at(c, Math.sin(a) * Rr, 0, Math.cos(a) * Rr, a + PI); g.add(c); }
      } else {
        g.add(at(B(W, .04, Dp, M.woodH, .006), 0, H - .02, 0)); const lx = W / 2 - .12, lz = Dp / 2 - .09; legs4(g, lx, lz, H - .04, .06, .036, .03);
        for (const sz of [-1, 1]) g.add(at(B(2 * lx - .06, .08, .024), 0, H - .08, sz * lz)); for (const sx of [-1, 1]) g.add(at(B(.024, .08, 2 * lz - .06), sx * lx, H - .08, 0));
        const per = Math.ceil(n / 2); for (let i = 0; i < per; i++) { const px = -W / 2 + (i + .5) * W / per; for (const sz of [-1, 1]) { const c = B3.chair(); at(c, px, 0, sz * (Dp / 2 + .14), sz > 0 ? PI : 0); g.add(c); } }
      }
      const v = lathe([[0, 0], [.05, 0], [.07, .06], [.045, .17], [.03, .24], [.035, .26]], M.ceramic); at(v, .05, H, 0); g.add(v);
      for (let i = 0; i < 5; i++) { const a = i * 1.3; g.add(tube([[.05, H + .2, 0], [.05 + Math.cos(a) * .08, H + .38, Math.sin(a) * .08], [.05 + Math.cos(a) * .2, H + .5, Math.sin(a) * .2]], .004, M.stem, 8)); }
      return g;
    },
    run(W, Dp, o) { // kitchen run, back at -Dp/2
      const g = new THREE.Group(), zb = -Dp / 2, fz = Dp / 2, fW = o.fridge ? .6 : 0, bW = W - fW, x0 = -W / 2;
      g.add(at(B(bW, .1, Dp - .08, M.plinth, .002), x0 + bW / 2, .05, -.04)); g.add(at(B(bW, .76, Dp - .03, M.carcass, .002), x0 + bW / 2, .48, -.015));
      const n = Math.max(1, Math.round(bW / .6)), mw = bW / n;
      let kc = -1, ks = -1; if (o.cook) kc = n >= 3 ? 1 : 0; if (o.sink) { ks = o.cook ? Math.min(n - 1, kc + 2) : Math.floor(n / 2); if (ks === kc) ks = n > 1 ? (kc + 1) % n : -1; }
      const front = (w, h, cx, cy, mat = M.fronts) => g.add(at(B(w, h, .019, mat, .002), cx, cy, fz - .0095));
      const handle = (cx, cy, w) => g.add(at(B(Math.min(.28, w * .5), .012, .025, M.metal, .005), cx, cy, fz + .012));
      for (let k = 0; k < n; k++) { const cx = x0 + mw * (k + .5), fw = mw - .004;
        if (k === kc) { front(fw, .17, cx, .1 + .085); handle(cx, .25, fw); g.add(at(B(fw, .46, .02, M.hob, .003), cx, .3 + .23, fz - .01)); g.add(at(B(fw * .8, .014, .03, M.steel, .006), cx, .72, fz + .015)); front(fw, .085, cx, .77 + .045); }
        else if (k === ks || k % 2) { front(fw, .755, cx, .1 + .38); handle(cx, .8, fw); }
        else for (let j = 0; j < 3; j++) { front(fw, .248, cx, .1 + .126 + j * .252); handle(cx, .1 + .21 + j * .252, fw); } }
      g.add(at(B(bW, .03, Dp + .02, M.worktop, .002), x0 + bW / 2, .875 + (o.off || 0), .01));
      g.add(at(B(bW, .55, .012, M.worktop, .001), x0 + bW / 2, .89 + .275, zb + .006));
      if (kc >= 0) { const cx = x0 + mw * (kc + .5); g.add(at(B(.58, .006, .5, M.hob, .002), cx, .893, .02)); for (const [dx, dz, r] of [[-.14, -.1, .09], [.14, -.1, .07], [-.14, .13, .07], [.14, .13, .09]]) g.add(at(cyl(r, r, .002, M.ring, 32), cx + dx, .897, .02 + dz)); }
      if (ks >= 0) { const cx = x0 + mw * (ks + .5); g.add(at(B(.52, .004, .42, M.steel, .002), cx, .892, .02)); g.add(at(B(.45, .003, .35, M.sinkIn, .001), cx, .895, .02));
        g.add(at(cyl(.025, .028, .05, M.metal, 16), cx, .915, zb + .1)); g.add(tube([[cx, .92, zb + .1], [cx, 1.22, zb + .1], [cx, 1.3, zb + .2], [cx, 1.2, zb + .32]], .011, M.metal)); }
      if (o.uppers !== false) for (let k = 0; k < n; k++) { const cx = x0 + mw * (k + .5), bot = k === kc ? 1.62 : 1.45, hh = 2.3 - bot;
        g.add(at(B(mw - .002, hh, .34, M.carcass, .002), cx, bot + hh / 2, zb + .17)); g.add(at(B(mw - .004, hh - .004, .019, M.fronts, .002), cx, bot + hh / 2, zb + .35));
        if (k === kc) g.add(at(B(mw - .02, .015, .32, M.steel, .002), cx, bot - .006, zb + .17)); else g.add(at(B(mw - .06, .008, .02, M.led, .002), cx, bot - .005, zb + .3)); }
      if (o.uppers !== false) g.add(at(B(bW, WH - 2.3 - .002, .34, M.fronts, .002), x0 + bW / 2, 2.3 + (WH - 2.3) / 2, zb + .17));
      if (o.fridge) { const cx = W / 2 - .3; g.add(at(B(.6, WH - .1, Dp - .03, M.carcass, .002), cx, .05 + (WH - .1) / 2 + .05, -.015));
        g.add(at(B(.596, 1.3, .019, M.fronts, .002), cx, .1 + .65, fz - .0095)); g.add(at(B(.596, .85, .019, M.fronts, .002), cx, 1.405 + .425, fz - .0095));
        g.add(at(B(.596, WH - 2.26, .019, M.fronts, .002), cx, 2.26 + (WH - 2.26) / 2, fz - .0095)); g.add(at(B(.014, .42, .025, M.metal, .005), cx - .26, 1.2, fz + .012)); g.add(at(B(.014, .3, .025, M.metal, .005), cx - .26, 1.55, fz + .012)); }
      if (o.decor) { const free = [...Array(n).keys()].find(k => k !== kc && k !== ks); if (free != null) { const cx = x0 + mw * (free + .5);
        g.add(at(B(.38, .022, .26, M.woodH, .02), cx - .05, .9 + .011, zb + .2, .15));
        for (let i = 0; i < 3; i++) g.add(at(cyl(.045, .045, .1 + i * .04, M.ceramic, 20), cx + .1 + i * .06 - .1, .89 + .05 + i * .02, zb + .07));
        const bw = lathe([[0, 0], [.07, 0], [.12, .05], [.13, .08], [.125, .08], [.11, .055], [0, .02]], M.ceramic); at(bw, cx + .16, .89, zb + .3); g.add(bw);
        for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.SphereGeometry(.035, 16, 12), M.fruit[i % 3]), cx + .16 + Math.cos(i * 1.7) * .05, .93 + (i > 2 ? .03 : 0), zb + .3 + Math.sin(i * 1.7) * .05)); } }
      return g;
    },
    island(W, Dp) {
      const g = new THREE.Group(), bd = Dp - .28;
      g.add(at(B(W - .04, .1, bd - .06, M.plinth, .002), 0, .05, .14)); g.add(at(B(W, .78, bd, M.carcass, .002), 0, .1 + .39, .14));
      const n = Math.max(1, Math.round(W / .6)), mw = W / n;
      for (let k = 0; k < n; k++) { const cx = -W / 2 + mw * (k + .5); for (let j = 0; j < 2; j++) { g.add(at(B(mw - .004, .375, .019, M.fronts, .002), cx, .1 + .19 + j * .38, Dp / 2 + .0095)); g.add(at(B(Math.min(.28, mw * .5), .012, .025, M.metal, .005), cx, .1 + .33 + j * .38, Dp / 2 + .03)); } }
      g.add(at(B(W + .04, .04, Dp, M.worktop, .003), 0, .9, 0));
      const ns = Math.max(1, Math.floor(W / .55)); for (let i = 0; i < ns; i++) { const sx = -W / 2 + (i + .5) * W / ns, sz = -Dp / 2 - .08, s = new THREE.Group();
        s.add(at(cyl(.18, .17, .045, M.woodH, 32), 0, .66, 0)); for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; s.add(at(cyl(.011, .011, .66, M.metal, 8), Math.cos(a) * .12, .33, Math.sin(a) * .12, 0, Math.sin(a) * .12, -Math.cos(a) * .12)); }
        s.add(at(mesh(new THREE.TorusGeometry(.15, .008, 8, 32), M.metal), 0, .25, 0, 0, PI / 2)); g.add(at(s, sx, 0, sz)); }
      return g;
    },
    wardrobe(W, Dp) {
      const g = new THREE.Group(), n = Math.max(2, Math.round(W / .5)), dw = W / n, hh = WH - .1;
      g.add(at(B(W - .02, .08, Dp - .06, M.plinth, .002), 0, .04, -.03)); g.add(at(B(W, hh - .08, Dp - .02, M.carcass, .002), 0, .08 + (hh - .08) / 2, -.01));
      for (let k = 0; k < n; k++) { const cx = -W / 2 + dw * (k + .5); g.add(at(B(dw - .004, hh - .085, .019, M.fronts, .002), cx, .085 + (hh - .085) / 2, Dp / 2 - .0095));
        g.add(at(B(.014, .5, .025, M.metal, .005), cx + (k % 2 ? -1 : 1) * (dw / 2 - .05), 1.12, Dp / 2 + .012)); }
      return g;
    },
    desk(W, Dp) {
      const g = new THREE.Group(), H = .74; g.add(at(B(W, .03, Dp, M.woodH, .005), 0, H - .015, 0)); legs4(g, W / 2 - .06, Dp / 2 - .06, H - .03, .045, .032, .015);
      g.add(at(B(W - .14, .1, .02), 0, H - .08, -Dp / 2 + .07));
      const c = B3.chair(); at(c, -.1, 0, Dp / 2 + .1, PI + .25); g.add(c);
      g.add(at(B(.32, .012, .22, M.steel, .004), .05, H + .006, .04)); g.add(at(B(.32, .21, .006, M.hob, .002), .05, H + .11, -.07, 0, -.18));
      g.add(at(cyl(.07, .08, .02, M.metal, 24), W / 2 - .16, H + .01, -Dp / 2 + .12)); g.add(tube([[W / 2 - .16, H, -Dp / 2 + .12], [W / 2 - .16, H + .42, -Dp / 2 + .1], [W / 2 - .3, H + .5, -Dp / 2 + .2]], .008, M.metal, 10));
      g.add(at(lathe([[0, 0], [.02, .0], [.08, .1], [.0, .1]], M.metal), W / 2 - .32, H + .4, -Dp / 2 + .22));
      M.book.slice(3).forEach((m, i) => g.add(at(B(.03, .22 - i * .02, .16, m, .002), -W / 2 + .12 + i * .034, H + .11 - i * .01, -Dp / 2 + .12)));
      g.add(at(cyl(.04, .035, .09, M.ceramic, 20), -W / 2 + .35, H + .045, .05));
      return g;
    },
    bath(W, Dp, x) {
      const g = new THREE.Group();
      if (D.wet === 'shower') return B3.shower(W, Dp, x, true);
      const sh = new THREE.Shape(se(W / 2 - .04, Dp / 2 - .03)); sh.holes.push(new THREE.Path(se(W / 2 - .1, Dp / 2 - .09).reverse()));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: .55, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 6 }); geo.rotateX(-PI / 2);
      g.add(mesh(geo, M.porcelain)); const bt = new THREE.ShapeGeometry(new THREE.Shape(se(W / 2 - .1, Dp / 2 - .09))); bt.rotateX(-PI / 2); bt.translate(0, .12, 0); g.add(mesh(bt, M.porcelain, false));
      const zw = -Dp / 2 - x.wall; g.add(at(cyl(.03, .03, .03, M.metal, 16), W / 2 - .3, .78, zw + .015, 0, PI / 2)); g.add(tube([[W / 2 - .3, .78, zw], [W / 2 - .3, .78, zw + .14], [W / 2 - .3, .72, zw + .2]], .012, M.metal, 10));
      g.add(at(B(.62, .02, .17, M.woodH, .006), .15, .58, 0, PI / 2)); g.add(at(cyl(.035, .035, .07, M.ceramic, 16), .15, .625, -.1));
      g.add(at(cushion(.36, .02, .5, .008, M.linen), -W / 2 + .25, .56, Dp / 2 - .05, 0, 0, 0));
      return g;
    },
    shower(W, Dp, x, wide) {
      const g = new THREE.Group(), zw = -Dp / 2 - x.wall, gl = Math.min(wide ? .95 : W - .05, W * .62);
      g.add(at(B(Math.min(.7, W - .2), .004, .05, M.steel, .001), 0, .003, zw + .1));
      g.add(at(B(gl, 2.0, .008, M.glassS, .001), -W / 2 + gl / 2, 1.02, Dp / 2)); g.add(at(B(gl, .02, .02, M.metal, .002), -W / 2 + gl / 2, 2.03, Dp / 2));
      g.add(at(B(.015, .015, Dp + x.wall, M.metal, .002), -W / 2 + gl - .02, 2.03, Dp / 2 - (Dp + x.wall) / 2));
      const hx = -W / 2 + gl / 2; g.add(at(B(.02, .02, .36, M.metal, .004), hx, 2.18, zw + .18)); g.add(at(cyl(.14, .14, .012, M.metal, 40), hx, 2.165, zw + .36));
      g.add(at(cyl(.03, .03, .05, M.metal, 16), hx + .25, 1.1, zw + .025, 0, PI / 2)); g.add(at(cyl(.008, .008, .7, M.metal, 8), hx + .45, 1.3, zw + .025));
      g.add(at(cyl(.022, .02, .2, M.metal, 12), hx + .45, 1.5, zw + .06, 0, .3));
      g.add(at(B(.36, .02, .1, M.tile, .003), W / 2 - .3, 1.15, zw + .05)); for (let i = 0; i < 3; i++) g.add(at(cyl(.03, .03, .16 - i * .02, M.book[[4, 1, 3][i]], 16), W / 2 - .42 + i * .1, 1.16 + .08 - i * .01, zw + .05));
      return g;
    },
    wc(W, Dp, x) {
      const g = new THREE.Group(), zw = -Dp / 2 - x.wall, lw = Math.min(1.1, W + .5);
      g.add(at(B(lw, 1.1, .2, M.tile, .003), 0, .55, zw + .1)); g.add(at(B(lw + .01, .02, .21, M.tile, .003), 0, 1.11, zw + .1));
      const zb = zw + .2; g.add(at(B(.36, .3, .54, M.porcelain, .11), 0, .4, zb + .27)); g.add(at(B(.37, .02, .48, M.porcelain, .01), 0, .565, zb + .27));
      g.add(at(B(.24, .16, .012, M.metal, .003), 0, .96, zb + .006));
      g.add(at(cyl(.055, .055, .1, M.linen, 20), W / 2 + .12, .72, zb + .15, 0, 0, PI / 2)); g.add(at(B(.12, .012, .02, M.metal, .003), W / 2 + .12, .79, zb + .15));
      return g;
    },
    sink(W, Dp, x) {
      const g = new THREE.Group(), zw = -Dp / 2 - x.wall, w = Math.min(W, 1.1), d = Math.min(Dp, .48), zc = -Dp / 2 + d / 2;
      g.add(at(B(w, .4, d, M.wood, .004), 0, .44 + .2, zc)); g.add(at(B(w - .04, .004, .004, M.plinth, .001), 0, .64, zc + d / 2 + .001));
      g.add(at(B(w + .01, .025, d + .01, M.worktop, .003), 0, .8525, zc));
      const bas = lathe([[0, 0], [.1, 0], [.17, .03], [.2, .09], [.2, .13], [.188, .13], [.18, .09], [.1, .03], [0, .03]], M.porcelain, 48); at(bas, 0, .865, zc + .02); g.add(bas);
      g.add(tube([[0, 1.12, zw], [0, 1.12, zc - .07]], .012, M.metal, 4)); g.add(at(cyl(.03, .03, .02, M.metal, 16), .13, 1.12, zw + .01, 0, PI / 2));
      const mr = Math.min(.36, w * .42); g.add(at(cyl(mr, mr, .012, M.mirror, 48), 0, 1.6, zw + .03, 0, PI / 2));
      g.add(at(mesh(new THREE.TorusGeometry(mr + .004, .008, 8, 64), M.led, false), 0, 1.6, zw + .018));
      g.add(at(cyl(.032, .03, .15, M.ceramic, 16), w / 2 - .12, .94, zc - .05)); g.add(at(cyl(.008, .008, .05, M.metal, 8), w / 2 - .12, 1.04, zc - .05));
      if (x.fits(w / 2 + .2, -Dp / 2 + .05, .05)) { g.add(at(mesh(new THREE.TorusGeometry(.1, .008, 8, 32), M.metal), w / 2 + .2, 1.0, zw + .05)); g.add(at(cushion(.24, .34, .03, .01, M.linen), w / 2 + .2, .88, zw + .06)); }
      return g;
    },
    plant() {
      const g = new THREE.Group(); const s = .9 + rnd() * .35;
      g.add(lathe([[0, 0], [.14 * s, 0], [.17 * s, .36 * s], [.16 * s, .38 * s], [.13 * s, .38 * s], [.13 * s, .32 * s]], M.pot)); g.add(at(cyl(.13 * s, .13 * s, .01, M.soil, 20), 0, .34 * s, 0));
      const stems = 3 + (rnd() * 2 | 0);
      for (let i = 0; i < stems; i++) { const a = rnd() * PI * 2, h = (.9 + rnd() * .6) * s, tx = Math.cos(a) * .18, tz = Math.sin(a) * .18;
        g.add(tube([[0, .33 * s, 0], [tx * .4, h * .6, tz * .4], [tx, h, tz]], .01, M.stem, 10));
        for (let j = 0; j < 7; j++) { const t = .35 + j / 7 * .65, lf = mesh(new THREE.PlaneGeometry(.2, .28), M.leaf); const px = tx * t, pz = tz * t, py = .33 * s + (h - .33 * s) * t + .05;
          at(lf, px + Math.cos(j * 2.3) * .08, py, pz + Math.sin(j * 2.3) * .08, j * 2.3 + rnd(), -.5 - rnd() * .5, rnd() * .6 - .3); g.add(lf); } }
      return g;
    }
  };

  function addItem(kind, x, z, w, d, extra = {}) {
    const r = roomAt(x + w / 2, z + d / 2); const o = orient(kind, x, z, w, d, r);
    const it = { id: items.length, kind, room: r ? r.i : -1, rect: [x, z, x + w, z + d], o, block: BLOCK.has(kind), loose: LOOSE.has(kind), extra, group: null, box: new THREE.Box3() };
    if (kind === 'table') { it.rect = [x - .35, z - .45, x + w + .35, z + d + .45]; }
    items.push(it); return it;
  }
  function makeItem(it) {
    const { o } = it, x = ctxFor(o), b = B3[it.kind === 'kitchen' ? 'run' : it.kind];
    seed(77 + it.id * 31);
    const g = it.kind === 'kitchen' ? B3.run(o.W, o.Dp, it.extra) : it.kind === 'table' ? B3.table(o.W, o.Dp, x, it.extra.n) : it.kind === 'plant' ? B3.plant() : b(o.W, o.Dp, x);
    if (it.group) { scene.remove(it.group); dispose(it.group); }
    const bg = bake(g); bg.position.set(o.cx, 0, o.cz); bg.rotation.y = o.rotY; bg.userData.item = it; bg.traverse(m => m.userData.item = it);
    bg.visible = D.furnish || !it.loose; scene.add(bg); it.group = bg; bg.updateMatrixWorld(true); it.box.setFromObject(bg);
  }
  function buildItems() {
    items = []; kitchenRuns = 0;
    const runs = [];
    for (const f of P.furn) {
      const [kind, x, z, w = .5, d = .5, , n = 4] = f;
      if (kind === 'plant') { addItem('plant', x - .2, z - .2, .4, .4); continue; }
      if (kind === 'kitchen-l') { runs.push(addItem('kitchen', x, z + d - .62, w, .62, {})); if (d > 1) runs.push(addItem('kitchen', x, z, .62, d - .62, {})); continue; }
      if (kind === 'kitchen') { runs.push(addItem('kitchen', x, z, w, d, {})); continue; }
      addItem(kind, x, z, w, d, kind === 'table' ? { n } : {});
    }
    runs.sort((a, b) => b.o.W - a.o.W); runs.forEach((r, i) => { r.extra = { fridge: i === 0 && r.o.W >= 1.8, cook: i === 0, sink: i === 0 ? r.o.W >= 2.4 || runs.length === 1 : i === 1 && runs[0].o.W < 2.4, decor: true, off: i * .0015 }; });
    for (const it of items) makeItem(it);
  }

  /* ---------------- light fittings ---------------- */
  function buildFixture(r) {
    const g = new THREE.Group(), type = D.light[r.i] || 'spots';
    const over = items.find(i => i.room === r.i && (i.kind === 'table' || i.kind === 'island'));
    let ax = r.cx, az = r.cz, along = 'x', span = 0, lowY = 2.25;
    if (over) { const [x0, z0, x1, z1] = over.kind === 'table' ? [over.rect[0] + .35, over.rect[1] + .45, over.rect[2] - .35, over.rect[3] - .45] : over.rect; ax = (x0 + x1) / 2; az = (z0 + z1) / 2; along = x1 - x0 >= z1 - z0 ? 'x' : 'z'; span = Math.max(x1 - x0, z1 - z0); lowY = over.kind === 'table' ? 1.55 : 1.72; }
    const P3 = (dx, y, k) => along === 'x' ? [ax + dx, y, az] : [ax, y, az + dx];
    const cord = (x, z, y) => { g.add(at(cyl(.004, .004, WH - y, M.cord, 6), x, (WH + y) / 2, z)); g.add(at(cyl(.05, .05, .02, M.skirt, 20), x, WH - .01, z)); };
    if (type === 'spots' || r.wet || r.key === 'hall') {
      const nx = Math.max(1, Math.round((r.x1 - r.x0 - .5) / 1.3)), nz = Math.max(1, Math.round((r.z1 - r.z0 - .5) / 1.3));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = r.x0 + (r.x1 - r.x0) * (i + .5) / nx, z = r.z0 + (r.z1 - r.z0) * (j + .5) / nz; g.add(at(cyl(.045, .045, .01, M.spot, 20), x, WH - .004, z)); g.add(at(mesh(new THREE.TorusGeometry(.05, .006, 6, 24), M.skirt), x, WH - .006, z, 0, PI / 2)); }
      return { g, x: r.cx, z: r.cz, y: 2.45 };
    }
    const count = over ? (over.kind === 'island' ? 3 : (type === 'linear' ? 1 : 2)) : 1, gap = over ? Math.min(.6, span / (count + .5)) : 0;
    for (let i = 0; i < count; i++) { const [x, , z] = P3((i - (count - 1) / 2) * gap, 0);
      if (type === 'globe') { const rr = over ? (count > 2 ? .12 : .17) : .2, y = over ? lowY + rr : 2.12; cord(x, z, y + rr); g.add(at(mesh(new THREE.SphereGeometry(rr, 32, 20), M.opal, false), x, y, z)); }
      else if (type === 'cone') { const y = over ? lowY + .2 : 2.1; cord(x, z, y + .24); const sh = lathe([[.012, .24], [.03, .23], [.17, .02], [.18, 0], [.175, 0], [.025, .225]], M.metal, 40); sh.castShadow = false; at(sh, x, y, z); g.add(sh); g.add(at(cyl(.16, .16, .004, M.opal, 32), x, y + .02, z)); }
      else if (type === 'linear') { const L = over ? Math.min(1.5, span * .8) : 1.2, y = over ? lowY + .12 : WH - .05; const bar = B(along === 'x' ? L : .06, .045, along === 'x' ? .06 : L, M.metal, .006); bar.castShadow = false; at(bar, x, y, z); g.add(bar);
        g.add(at(B(along === 'x' ? L - .04 : .035, .006, along === 'x' ? .035 : L - .04, M.opal, .001), x, y - .025, z));
        if (over) for (const s of [-1, 1]) { const [cx, , cz] = P3((i - (count - 1) / 2) * gap + s * L * .4, 0); g.add(at(cyl(.002, .002, WH - y, M.cord, 4), cx, (WH + y) / 2, cz)); } }
    }
    return { g, x: ax, z: az, y: Math.min(2.4, (over ? lowY : 2.1) + .05) };
  }
  function makeFixtures(only) {
    for (const r of rooms) { if (only != null && only !== r.i) continue;
      const old = fixtures[r.i]; if (old) { scene.remove(old.group); dispose(old.group); }
      const f = buildFixture(r), bg = bake(f.g); bg.traverse(m => { m.castShadow = false; m.userData.fixture = r.i; }); scene.add(bg);
      fixtures[r.i] = { group: bg }; const L = lights[r.i]; if (L) { L.position.set(f.x, f.y, f.z); } }
  }

  /* ---------------- outside: balcony + city ---------------- */
  function buildOutside() {
    const g = new THREE.Group();
    if (unit.terrace) {
      const td = unit.type === 'P4' ? 4.2 : 1.6, tw = unit.type === 'P4' ? P.W : Math.min(P.W - .6, 4.6), tx = unit.type === 'P4' ? P.W / 2 : .3 + tw / 2, z0 = -TE / 2;
      const deck = new THREE.BoxGeometry(tw, .06, td); deck.translate(tx, -.03, z0 - td / 2); const p = deck.attributes.position, uv = deck.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); g.add(mesh(deck, M.deck));
      g.add(at(B(tw, 1.0, .02, M.rail, .001), tx, .52, z0 - td)); for (const s of [-1, 1]) g.add(at(B(.02, 1.0, td, M.rail, .001), tx + s * tw / 2, .52, z0 - td / 2));
      g.add(at(B(tw, .03, .05, M.frame, .004), tx, 1.03, z0 - td));
      const bx = tx + tw / 2 - .7, bz = z0 - td / 2; g.add(at(cyl(.28, .28, .025, M.woodH, 32), bx, .72, bz)); g.add(at(cyl(.025, .025, .7, M.frame, 10), bx, .35, bz)); g.add(at(cyl(.2, .22, .02, M.frame, 24), bx, .01, bz));
      for (const s of [-1, 1]) { const c = B3.chair(false); at(c, bx + s * .55, 0, bz, -s * PI / 2); g.add(c); }
      if (unit.type === 'P4') { for (const px of [.7, P.W - .7]) { g.add(at(B(.9, .5, .5, M.frame, .01), px, .25, z0 - td + .4)); const pl = B3.plant(); at(pl, px, .3, z0 - td + .4); g.add(pl); } }
    }
    const og = bake(g); scene.add(og); return og;
  }

  /* ---------------- materials from design state ---------------- */
  async function setWood() {
    const w = D.wood, t = await woodTex(w), wd = WOOD[w];
    [[M.wood, wd.rot + PI / 2], [M.woodH, wd.rot]].forEach(([m, r]) => { const mp = t.map.clone(); mp.needsUpdate = true; mp.center.set(.5, .5); mp.rotation = r; m.map = mp; m.roughnessMap = t.rough; m.normalMap = t.nor; m.normalScale = new THREE.Vector2(.3, .3); m.roughness = wd.rough; m.color.set(wd.tint); m.needsUpdate = true; });
  }
  let oakT = null;
  async function oakMat(m, rot) { oakT = oakT || await woodTex('oak'); const mp = oakT.map.clone(); mp.needsUpdate = true; mp.center.set(.5, .5); mp.rotation = rot; m.map = mp; m.roughnessMap = oakT.rough; m.normalMap = oakT.nor; m.normalScale = new THREE.Vector2(.3, .3); m.color.set(0xffffff); m.roughness = .6; m.needsUpdate = true; }
  const flat = (m, c, rough) => { m.map = null; m.roughnessMap = null; m.normalMap = null; m.color.set(c); m.roughness = rough; m.needsUpdate = true; };
  async function applyMaterials() {
    rooms.forEach(r => { (M.paint[r.i] ||= std({ roughness: .9 })).color.set(OPTIONS.paint[D.paint[r.i]]); });
    M.floor.map = floorTex(D.floor); M.floor.roughness = D.floor === 'micro' ? .7 : .55; M.floor.needsUpdate = true;
    const tt = tileTex(D.tile); M.tile.map = tt; M.tile.roughness = { porcelain: .35, terrazzo: .4, zellige: .15, slate: .6 }[D.tile]; M.tile.needsUpdate = true;
    M.fabric.color.set(OPTIONS.fabric[D.fabric]); M.accent.color.set(ACCENT[D.fabric]);
    M.rug.map = rugTex[D.rug === 'stripe' ? 'stripe' : 'wool']; M.rug.color.set(D.rug === 'stripe' ? 0xffffff : new THREE.Color(OPTIONS.fabric[D.fabric]).lerp(new THREE.Color(0xeee6d8), .62)); M.rug.needsUpdate = true;
    const [mc, mm, mr] = { chrome: [0xdcdcdc, 1, .1], black: [0x1c1c1c, .5, .45], brass: [0xb48f55, .9, .28] }[D.metal]; M.metal.color.set(mc); M.metal.metalness = mm; M.metal.roughness = mr;
    if (D.fronts === 'oak') await oakMat(M.fronts, PI); else flat(M.fronts, OPTIONS.fronts[D.fronts], .5);
    if (D.worktop === 'oak') await oakMat(M.worktop, PI / 2); else if (D.worktop === 'quartz') { flat(M.worktop, 0xffffff, .25); M.worktop.map = quartz(); } else if (D.worktop === 'terrazzo') { flat(M.worktop, 0xffffff, .35); M.worktop.map = tileTex('terrazzo'); } else flat(M.worktop, 0x1d1d1d, .3);
    M.worktop.needsUpdate = true;
    M.pot.color.set(D.style === 'akmuo' ? 0x2a2a2a : D.style === 'miskas' ? 0xe7e0d4 : 0xb8704e);
    await setWood();
  }

  /* ---------------- lighting modes ---------------- */
  let texDay = null, texEve = null;
  function setEvening(on) {
    D.evening = on; sun.intensity = on ? 0 : 2.7; hemi.intensity = on ? .03 : .36; scene.environmentIntensity = on ? .08 : .48;
    M.opal.emissiveIntensity = on ? 3 : .12; M.spot.emissiveIntensity = on ? 4 : .25; M.shade.emissiveIntensity = on ? 1.6 : 0; M.led.emissiveIntensity = on ? 2.6 : .3;
    lights.forEach(l => l.intensity = on ? l.userData.I : 0);
    backdrop.material.map = on ? texEve : texDay; backdrop.material.color.set(on ? 0x46506a : 0xffffff); backdrop.material.needsUpdate = true;
    scene.background.set(on ? 0x27303c : 0xcfd8de); expo = on ? 1.15 : 1.0; renderer.toneMappingExposure = expo; shadowsDirty(); kick();
  }
  let expo = 1;

  /* ---------------- load an apartment ---------------- */
  let loaded = null;
  async function load(u, styleName = D.style) {
    unit = u; P = PLANS[u.type];
    if (shell) { scene.remove(shell); dispose(shell); } if (outside) { scene.remove(outside); dispose(outside); }
    items.forEach(i => { scene.remove(i.group); dispose(i.group); }); fixtures.forEach(f => f && (scene.remove(f.group), dispose(f.group))); fixtures = [];
    lights.forEach(l => scene.remove(l)); lights = [];
    rooms = P.rooms.map(([name, x0, z0, x1, z1], i) => { const key = ROOMKEY[name]; return { i, name, key, x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, area: (x1 - x0) * (z1 - z0), wet: WET.has(key) }; });
    ops = P.open.map(([x0, z0, x1, z1]) => { const h = Math.abs(z0 - z1) < 1e-3, len = h ? Math.abs(x1 - x0) : Math.abs(z1 - z0); if (len < .05) return null; const c = h ? z0 : x0, a = Math.min(h ? x0 : z0, h ? x1 : z1);
      const ext = h ? isExtH(c) : isExtV(c); return { h, c, a, b: a + len, len, kind: ext ? 'entry' : len > 1.6 ? 'open' : len > 1.0 ? 'pass' : 'door' }; }).filter(Boolean);
    D.wet = P.furn.some(f => f[0] === 'bath') ? (D.wet || 'bath') : 'shower';
    applyStyle(styleName);
    const [img] = await Promise.all([tex('tex/oak_d1.webp', 1), tex('img/oldtown-800.webp', 1).then(t => { M.art1.map = t; M.art1.needsUpdate = true; }), tex('img/embankment-800.webp', 1).then(t => { M.art2.map = t; M.art2.needsUpdate = true; }),
      tex('img/skyline-1600.webp', 1).then(t => { texDay = t; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }), tex('img/evening-1600.webp', 1).then(t => { texEve = t; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; })]);
    oakSrc = oakSrc || grainH(img.image);
    if (!M.deck.map) { M.deck.map = floorTex('oak').clone(); M.deck.map.needsUpdate = true; M.deck.color.set(0xb8b0a4); }
    await applyMaterials();
    shell = buildShell(); scene.add(shell);
    buildItems(); outside = buildOutside();
    const maxL = LOW ? 5 : 8; const lit = [...rooms].sort((a, b) => (b.wet ? 0 : b.area) - (a.wet ? 0 : a.area)).slice(0, maxL);
    for (const r of rooms) { const l = new THREE.PointLight(0xffd3a0, 0, Math.max(r.x1 - r.x0, r.z1 - r.z0) * 1.6 + 1.5, 2); l.userData.I = lit.includes(r) ? 4.5 + r.area * .45 : 0; lights[r.i] = l; scene.add(l); }
    makeFixtures();
    // sun from the balcony side, low enough to throw window light deep into the room
    const cx = P.W / 2, cz = P.D / 2, sz = Math.max(P.W, P.D) * .85 + 2;
    sun.position.set(cx - 5.5, 6.2, -7.5); sun.target.position.set(cx, 0, cz); Object.assign(sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 30 }); sun.shadow.camera.updateProjectionMatrix();
    backdrop.position.set(P.W / 2, 3 - u.floor * .9, -46);
    setEvening(D.evening);
    try { renderer.compile(scene, cam); } catch {}
    start(); oy = PI - .62; ot = .92; oz = 1; loaded = u; shadowsDirty(); kick();
    return rooms;
  }
  function shadowsDirty() { renderer.shadowMap.needsUpdate = true; needs = true; }

  /* ---------------- design changes ---------------- */
  async function set(key, val, room) {
    if (key === 'style') { applyStyle(val); await applyMaterials(); items.forEach(makeItem); makeFixtures(); }
    else if (key === 'paint') { if (room == null) D.paint = D.paint.map((v, i) => rooms[i].wet ? v : val); else D.paint[room] = val; await applyMaterials(); }
    else if (key === 'light') { if (room == null) { D.light = D.light.map((v, i) => rooms[i].wet || rooms[i].key === 'hall' ? v : val); makeFixtures(); } else { D.light[room] = val; makeFixtures(room); } }
    else if (key === 'evening') setEvening(val);
    else if (key === 'furnish') { D.furnish = val; items.forEach(i => { if (i.loose) i.group.visible = val; }); }
    else { D[key] = val;
      if (key === 'sofa' || key === 'table' || key === 'rug') items.filter(i => i.kind === key).forEach(makeItem);
      else if (key === 'wet') items.filter(i => i.kind === 'bath').forEach(makeItem);
      else await applyMaterials(); }
    if (sel) highlight(sel); shadowsDirty(); kick();
  }
  function price() {
    const dry = rooms.filter(r => !r.wet).reduce((a, r) => a + r.area, 0), wetA = rooms.filter(r => r.wet).reduce((a, r) => a + r.area + 2 * ((r.x1 - r.x0) + (r.z1 - r.z0)) * WH * .85, 0);
    const lines = [], round = v => Math.round(v / 10) * 10;
    lines.push(['p_floor', round(UP.floor[D.floor] * dry)], ['p_tile', round(UP.tile[D.tile] * wetA)], ['p_fronts', UP.fronts[D.fronts]], ['p_worktop', UP.worktop[D.worktop]], ['p_metal', UP.metal[D.metal]], ['p_light', D.light.reduce((a, l, i) => a + (rooms[i].wet || rooms[i].key === 'hall' ? 0 : UP.light[l]), 0)]);
    let furn = 0;
    for (const it of items) { if (!it.loose) continue; const k = it.kind;
      if (k === 'sofa') furn += FURN.sofa[D.sofa] + FURN.lamp + FURN.art; else if (k === 'bed') furn += FURN.bed + FURN.art; else if (k === 'table') furn += FURN.table + FURN.chair * Math.min(it.extra.n || 4, D.table === 'round' ? 5 : 8);
      else if (k === 'rug') furn += D.rug === 'none' ? 0 : FURN.rug; else if (FURN[k]) furn += FURN[k]; }
    furn = round(furn * { oak: 1, ash: 1, walnut: 1.18 }[D.wood]);
    const fin = lines.reduce((a, l) => a + l[1], 0);
    return { lines, finishes: fin, furniture: D.furnish ? furn : 0, total: fin + (D.furnish ? furn : 0) };
  }

  /* ---------------- camera, walking, input ---------------- */
  let mode = 'orbit', host = null, running = false, needs = true, active = false, last = 0;
  let oy = PI - .62, ot = .92, oz = 1; const pos = new THREE.Vector2(), vel = new THREE.Vector2(); let yaw = 0, pitch = -.06, bob = 0, target = null, stuck = 0, curRoom = -1;
  const keys = new Set(); const joyV = [0, 0]; let joyOn = false; let onRoom = null, onSelect = null, onFrame = null;
  function start() {
    const en = ops.find(o => o.kind === 'entry' && o.h && Math.abs(o.c - P.D) < 1e-3);
    if (en) pos.set((en.a + en.b) / 2, P.D - .75); else { const h = rooms.find(r => r.key === 'hall') || rooms[0]; pos.set(h.cx, h.cz); }
    collide(pos); yaw = 0; pitch = -.06; vel.set(0, 0); target = null; curRoom = -1;
  }
  function fov() { const a = cam.aspect; if (mode === 'walk') { const v = 2 * Math.atan(Math.tan(88 * PI / 360) / a) * 180 / PI; cam.fov = Math.min(92, Math.max(58, v)); cam.near = .04; } else { cam.fov = 34; cam.near = .3; } cam.updateProjectionMatrix(); }
  function placeOrbit() { const c = new THREE.Vector3(P.W / 2, .4, P.D / 2 - (unit.terrace ? .7 : 0)); const size = Math.max(P.W, P.D + (unit.terrace ? 1.6 : 0)); const d = (size * 1.45 + 2.5) / Math.min(1.25, Math.max(.6, cam.aspect)) * oz;
    cam.position.set(c.x + Math.sin(oy) * Math.cos(ot) * d, c.y + Math.sin(ot) * d, c.z + Math.cos(oy) * Math.cos(ot) * d); cam.lookAt(c); }
  function placeWalk() { cam.position.set(pos.x, EYE + Math.sin(bob) * .012, pos.y); cam.rotation.set(pitch, yaw, 0); }
  function collide(p) {
    const lim = [TE / 2 + RAD, TE / 2 + RAD, P.W - TE / 2 - RAD, P.D - TE / 2 - RAD];
    for (let k = 0; k < 3; k++) {
      for (const r of solid) push(p, r);
      for (const it of items) if (it.block && it.group.visible) push(p, [it.rect[0] + .03, it.rect[1] + .03, it.rect[2] - .03, it.rect[3] - .03]);
      p.x = Math.min(lim[2], Math.max(lim[0], p.x)); p.y = Math.min(lim[3], Math.max(lim[1], p.y));
    }
  }
  function push(p, [x0, z0, x1, z1]) { const cx = Math.max(x0, Math.min(x1, p.x)), cz = Math.max(z0, Math.min(z1, p.y)); let dx = p.x - cx, dz = p.y - cz; const d2 = dx * dx + dz * dz;
    if (d2 >= RAD * RAD) return; if (d2 < 1e-9) { const o = [p.x - x0, x1 - p.x, p.y - z0, z1 - p.y], m = Math.min(...o); if (m === o[0]) p.x = x0 - RAD; else if (m === o[1]) p.x = x1 + RAD; else if (m === o[2]) p.y = z0 - RAD; else p.y = z1 + RAD; return; }
    const d = Math.sqrt(d2); p.x = cx + dx / d * RAD; p.y = cz + dz / d * RAD; }
  function step(dt) {
    const kf = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) + joyV[1];
    const ks = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0) + joyV[0];
    const turn = (keys.has('arrowleft') || keys.has('q') ? 1 : 0) - (keys.has('arrowright') || keys.has('e') ? 1 : 0); if (turn) yaw += turn * 1.7 * dt;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), SP = 1.45;
    let wx = (fx * kf + rx * ks) * SP, wz = (fz * kf + rz * ks) * SP;
    if (kf || ks) target = null;
    if (target) { const dx = target.x - pos.x, dz = target.y - pos.y, d = Math.hypot(dx, dz); if (d < .12) target = null; else { const s = Math.min(SP, d * 2.5); wx = dx / d * s; wz = dz / d * s; } }
    const m = Math.hypot(wx, wz); if (m > SP) { wx *= SP / m; wz *= SP / m; }
    const k = 1 - Math.exp(-dt * 9); vel.x += (wx - vel.x) * k; vel.y += (wz - vel.y) * k;
    const sp = vel.length(); if (sp < .01 && !turn) { vel.set(0, 0); return !!turn; }
    const before = pos.clone(); pos.x += vel.x * dt; pos.y += vel.y * dt; collide(pos);
    if (target) { const moved = pos.distanceTo(before); if (moved < sp * dt * .25) { if ((stuck += dt) > .25) { target = null; stuck = 0; } } else stuck = 0; }
    bob += dt * sp * 6.5;
    const r = roomAt(pos.x, pos.y); if (r && r.i !== curRoom) { curRoom = r.i; onRoom && onRoom(r); }
    return true;
  }
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; let moving = false;
    if (mode === 'walk') moving = step(dt);
    if (moving || needs) { mode === 'walk' ? placeWalk() : placeOrbit(); renderer.toneMappingExposure = expo; renderer.render(scene, cam); needs = false; onFrame && onFrame(); }
    if (active && (moving || dragging || keys.size || joyOn || target)) requestAnimationFrame(loop); else running = false;
  }
  const kick = () => { needs = true; if (!running && active) { running = true; last = performance.now(); requestAnimationFrame(loop); } };
  function setMode(m) { mode = m; M.ceil.colorWrite = m === 'walk'; M.ceil.depthWrite = m === 'walk'; M.ceil.needsUpdate = true; fov(); if (m === 'walk' && curRoom < 0) { const r = roomAt(pos.x, pos.y); if (r) { curRoom = r.i; onRoom && onRoom(r); } } kick(); }
  function teleport(i) { const r = rooms[i]; let best = null, bd = 1e9;
    for (let gx = 0; gx <= 8; gx++) for (let gz = 0; gz <= 8; gz++) { const p = new THREE.Vector2(r.x0 + .35 + (r.x1 - r.x0 - .7) * gx / 8, r.z0 + .35 + (r.z1 - r.z0 - .7) * gz / 8), q = p.clone(); collide(q); if (q.distanceTo(p) > .01) continue; const d = p.distanceTo(new THREE.Vector2(r.cx, r.cz)); if (d < bd) { bd = d; best = p; } }
    if (best) pos.copy(best); else { pos.set(r.cx, r.cz); collide(pos); }
    // face the window if the room has one, otherwise the longest way across; step back toward the opposite wall
    const dirs = [['-z', 0, 0, -1], ['+z', PI, 0, 1], ['-x', PI / 2, -1, 0], ['+x', -PI / 2, 1, 0]];
    const free = d => { const q = pos.clone(); let n = 0; for (; n < 60; n++) { q.x += d[2] * .1; q.y += d[3] * .1; const c = q.clone(); collide(c); if (c.distanceTo(q) > .02 || !roomAt(q.x, q.y)) break; } return n * .1; };
    if (r.z0 < .01) { const back = dirs[1], bf = Math.max(0, free(back) - .15); pos.x += back[2] * bf; pos.y += back[3] * bf; collide(pos); yaw = 0; }
    else { // stand in the freest corner and look across the diagonal
      let bestC = null, bestD = -1; const m = .42;
      for (const [cx, cz] of [[r.x0 + m, r.z0 + m], [r.x1 - m, r.z0 + m], [r.x0 + m, r.z1 - m], [r.x1 - m, r.z1 - m]]) { const p = new THREE.Vector2(cx, cz), q = p.clone(); collide(q); if (q.distanceTo(p) > .05) continue; const d = Math.hypot(r.cx - cx, r.cz - cz); if (d > bestD) { bestD = d; bestC = p; } }
      if (bestC) pos.copy(bestC); const dx = r.cx - pos.x, dz = r.cz - pos.y; yaw = Math.atan2(-dx, -dz); }
    pitch = -.1; target = null; vel.set(0, 0);
    curRoom = r.i; onRoom && onRoom(r); if (mode !== 'walk') setMode('walk'); kick(); }

  // pointer: drag to look / orbit, tap to walk or select, pinch / wheel to zoom the overview
  const canvas = renderer.domElement, ptrs = new Map(); let dragging = false, down = null, pinch0 = 0;
  const onDown = e => { if (!active || e.target !== canvas) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
    else { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); if (down) down.moved = true; }
    dragging = true; kick(); };
  const onMove = e => { if (!active || !ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (mode === 'orbit' && pinch0) { oz = Math.min(1.7, Math.max(.4, oz * pinch0 / d)); pinch0 = d; needs = true; } return; }
    if (!down) return; const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) down.moved = true;
    if (mode === 'walk') { yaw += dx * .0042; pitch = Math.max(-1.1, Math.min(1.0, pitch + dy * .0035)); } else { oy -= dx * .006; ot = Math.max(.32, Math.min(1.45, ot + dy * .004)); }
    needs = true; };
  const onUp = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
    if (ptrs.size === 0) { dragging = false; if (down && !down.moved && performance.now() - down.t < 450) tap(e); down = null; pinch0 = 0; kick(); } };
  const onWheel = e => { if (!active || mode !== 'orbit') return; e.preventDefault(); oz = Math.min(1.7, Math.max(.4, oz * (1 + e.deltaY * .0012))); kick(); };
  const onKey = (e, on) => { if (!active || mode !== 'walk' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return; const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { e.preventDefault(); on ? keys.add(k) : keys.delete(k); kick(); } };
  const kd = e => onKey(e, true), ku = e => onKey(e, false), blur = () => { keys.clear(); };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let sel = null, helper = null;
  function tap(e) {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam);
    const objs = []; scene.traverse(o => { if (o.isMesh && o.visible && !o.material.transparent && o !== backdrop && !(mode === 'orbit' && o.material === M.ceil) && o.parent?.visible !== false) objs.push(o); });
    const hit = ray.intersectObjects(objs, false)[0]; if (!hit) return;
    const o = hit.object, n = hit.face ? hit.face.normal.clone().transformDirection(o.matrixWorld) : new THREE.Vector3(0, 1, 0), room = roomAt(hit.point.x, hit.point.z);
    if (o.userData.item) { select({ type: 'item', item: o.userData.item, cat: o.userData.item.kind, room: o.userData.item.room }); return; }
    if (o.userData.fixture != null) { select({ type: 'light', room: o.userData.fixture }); return; }
    if (o.material === M.ceil) { if (room) select({ type: 'light', room: room.i }); return; }
    const isFloor = (o.material === M.floor || o.material === M.tile) && n.y > .6;
    if (isFloor && mode === 'walk') { target = new THREE.Vector2(hit.point.x, hit.point.z); stuck = 0; clearSel(); kick(); return; }
    if (isFloor) { select({ type: 'floor', room: room?.i ?? -1, wet: room?.wet }); return; }
    if (room) select({ type: 'wall', room: room.i, wet: room.wet });
  }
  function highlight(s) { if (helper) { scene.remove(helper); helper.geometry.dispose(); helper = null; }
    if (s?.type === 'item') { s.item.box.setFromObject(s.item.group); helper = new THREE.Box3Helper(s.item.box.clone().expandByScalar(.02), 0xc2502a); scene.add(helper); } needs = true; }
  function select(s) { sel = s; highlight(s); onSelect && onSelect(s); kick(); }
  function clearSel() { sel = null; highlight(null); }

  let ro = null;
  function size() { if (!host) return; const r = host.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; fov(); needs = true; }
  function mount(el) { host = el; el.prepend(canvas); canvas.style.touchAction = 'none'; active = true; ro = ro || new ResizeObserver(() => { size(); kick(); }); ro.observe(el); size();
    canvas.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp); canvas.addEventListener('wheel', onWheel, { passive: false });
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur); renderer.toneMappingExposure = expo; shadowsDirty(); kick(); }
  function unmount() { active = false; keys.clear(); joyV[0] = joyV[1] = 0; joyOn = false; if (ro && host) ro.unobserve(host); canvas.style.touchAction = 'pan-y';
    canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); canvas.removeEventListener('wheel', onWheel);
    removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur); clearSel(); }
  function snapshot(w, h) { const pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(w, h, false); cam.aspect = w / h; fov(); mode === 'walk' ? placeWalk() : placeOrbit(); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); const url = canvas.toDataURL('image/jpeg', .9); renderer.setPixelRatio(pr); size(); return url; }

  return {
    load, set, price, mount, unmount, teleport, snapshot, kick,
    get D() { return D; }, get rooms() { return rooms; }, get unit() { return unit; }, get mode() { return mode; }, get loaded() { return loaded; },
    get pose() { return { x: pos.x, z: pos.y, yaw, room: curRoom, W: P?.W, D: P?.D }; },
    mode_: setMode, setMode, clearSel,
    joy(x, y, on) { joyV[0] = x; joyV[1] = y; joyOn = on; if (on) target = null; kick(); },
    walkTo(x, z) { target = new THREE.Vector2(x, z); kick(); },
    view(o) { if (o.pos) pos.set(o.pos[0], o.pos[1]); if (o.yaw != null) yaw = o.yaw; if (o.pitch != null) pitch = o.pitch; if (o.oy != null) oy = o.oy; if (o.ot != null) ot = o.ot; if (o.oz != null) oz = o.oz; collide(pos); kick(); },
    set onRoom(f) { onRoom = f; }, set onSelect(f) { onSelect = f; }, set onFrame(f) { onFrame = f; }
  };
}
