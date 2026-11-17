// Vėjo laiptai — apartments, layouts, prices (concept data, deterministic)
export const VOLS = [
  { id: 'A', x0: -27, floors: 8 },   // ground + 7 residential (top = penthouses)
  { id: 'B', x0: -9, floors: 6 },
  { id: 'C', x0: 9, floors: 4 }
];
export const VW = 18, DEPTH = 14, FH = 3.1;
export const TYPES = {
  S1: { rooms: 1, label: '1 room', area: 40.5, w: 4.5 },
  T2: { rooms: 2, label: '2 rooms', area: 57.2, w: 6.5 },
  T3: { rooms: 3, label: '3 rooms', area: 74.8, w: 7 },
  P4: { rooms: 4, label: '4-room penthouse', area: 112.4, w: 9, terrace: 46 }
};
const ROW = ['T3', 'S1', 'T2'];      // widths 7 + 4.5 + 6.5 = 18
const PEN = ['P4', 'P4'];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const r = rng(20271);

export const UNITS = [];
for (const v of VOLS) {
  for (let f = 1; f < v.floors; f++) {
    const top = f === v.floors - 1; const row = top ? PEN : ROW; let x = v.x0;
    row.forEach((t, i) => {
      const T = TYPES[t];
      const base = 3650 + f * 85 + (top ? 650 : 0) + (v.id === 'C' ? 120 : 0) + (t === 'S1' ? 260 : 0);
      const price = Math.round(T.area * base / 500) * 500;
      const roll = r(); const sold = roll < (top ? .45 : f <= 2 ? .38 : .22); const res = !sold && roll < (top ? .6 : .34);
      const orient = i === 0 && v.id === 'A' ? 'South-west + south-east' : i === row.length - 1 && v.id === 'C' ? 'South-west + north-west' : 'South-west';
      UNITS.push({
        id: `${v.id}-${f}.${i + 1}`, vol: v.id, floor: f, idx: i, type: t, rooms: T.rooms, area: T.area, terrace: T.terrace || (i !== 1 ? (t === 'T3' ? 8.4 : 6.1) : 0),
        x: x, w: T.w, price, ppm: Math.round(price / T.area), status: sold ? 'sold' : res ? 'reserved' : 'free', orient, top
      });
      x += T.w;
    });
  }
}
export const byId = id => UNITS.find(u => u.id === id);

// floor plans in metres. x across the facade (0 = left), z from window wall (0) to corridor wall (D)
// rooms: [name, x0, z0, x1, z1]; doors: [x0, z0, x1, z1] wall pieces left open; furn: [kind, x, z, w, d, rot]
export const PLANS = {
  S1: { W: 4.5, D: 9,
    rooms: [['Living & sleeping', 0, 0, 4.5, 5.4], ['Kitchen', 0, 5.4, 2.6, 9], ['Bathroom', 2.6, 5.4, 4.5, 7.4], ['Hall', 2.6, 7.4, 4.5, 9]],
    open: [[0.9, 5.4, 2.6, 5.4], [2.6, 7.55, 2.6, 8.3], [3.1, 7.4, 3.9, 7.4], [3.45, 9, 4.35, 9]],
    furn: [['bed', 2.7, .5, 1.6, 2.05], ['side', 2.2, .55, .45, .4], ['sofa', .15, 2.9, .9, 2.0, 1], ['rug', 1.1, 2.8, 1.6, 2.0], ['wardrobe', 3.8, 3.0, .6, 2.0], ['kitchen-l', .1, 5.45, 2.45, 3.45], ['shower', 3.6, 5.5, .85, .85], ['wc', 2.75, 5.5, .4, .6], ['sink', 3.95, 6.45, .5, .45], ['plant', .25, .3]]
  },
  T2: { W: 6.5, D: 9,
    rooms: [['Living & kitchen', 0, 0, 6.5, 4.6], ['Bedroom', 0, 4.6, 3.6, 9], ['Bathroom', 3.6, 6.6, 5.5, 9], ['Hall', 3.6, 4.6, 6.5, 6.6], ['Hall', 5.5, 6.6, 6.5, 9]],
    open: [[5.7, 4.6, 6.5, 4.6], [3.6, 5.1, 3.6, 6.0], [4.3, 6.6, 5.1, 6.6], [5.5, 6.6, 6.5, 6.6], [5.55, 9, 6.45, 9]],
    furn: [['sofa', .3, .5, 2.4, .95], ['rug', .4, 1.5, 2.2, 1.6], ['ctable', 1.0, 1.8, 1.0, .6], ['table', 3.6, .9, 1.6, .9, 0, 4], ['kitchen', 3.2, 3.95, 2.4, .62], ['island', 3.4, 2.85, 1.7, .75], ['bed', .9, 6.6, 1.6, 2.05], ['side', .4, 8.1, .45, .4], ['side', 2.55, 8.1, .45, .4], ['wardrobe', .1, 4.7, 2.4, .6], ['bath', 3.65, 7.25, .7, 1.7], ['wc', 4.95, 8.35, .4, .6], ['sink', 4.4, 8.5, .5, .45], ['plant', 2.9, .3]]
  },
  T3: { W: 7, D: 10.5,
    rooms: [['Living & kitchen', 0, 0, 4.4, 6.2], ['Bedroom', 4.4, 0, 7, 4.4], ['Bedroom', 0, 6.2, 3.4, 10.5], ['Bathroom', 5.4, 7.6, 7, 10.5], ['Hall', 3.4, 6.2, 7, 7.6], ['Hall', 4.4, 4.4, 7, 6.2], ['Hall', 4.4, 7.6, 5.4, 10.5], ['WC', 3.4, 7.6, 4.4, 10.5]],
    open: [[3.4, 6.2, 4.4, 6.2], [4.4, 4.4, 4.4, 6.2], [4.4, 6.2, 7, 6.2], [4.4, 7.6, 5.4, 7.6], [6.05, 4.4, 6.9, 4.4], [3.4, 6.45, 3.4, 7.25], [5.4, 8.6, 5.4, 9.4], [3.5, 7.6, 4.3, 7.6], [4.45, 10.5, 5.35, 10.5]],
    furn: [['sofa', .3, .45, 2.4, .95], ['rug', .4, 1.45, 2.3, 1.6], ['ctable', 1.05, 1.75, 1.0, .6], ['table', 1.2, 3.0, 1.6, .9, 0, 4], ['kitchen-l', .1, 4.4, 3.1, 1.75], ['bed', 4.55, 1.9, 1.4, 2.05], ['wardrobe', 6.35, .5, .6, 1.4], ['bed', .9, 8.4, 1.4, 2.0], ['desk', .15, 6.35, 1.3, .6], ['wardrobe', 2.75, 8.0, .6, 2.3], ['bath', 6.25, 8.7, .7, 1.7], ['sink', 5.5, 7.65, .9, .45], ['wc', 3.7, 9.75, .4, .6], ['plant', 3.9, .3]]
  },
  P4: { W: 9, D: 12.5,
    rooms: [['Living & dining', 0, 0, 5.6, 6.4], ['Kitchen', 5.6, 3.6, 9, 6.4], ['Study', 5.6, 0, 9, 3.6], ['Bedroom', 0, 8.6, 4.0, 12.5], ['Bedroom', 0, 6.4, 4.0, 8.6], ['Main bedroom', 4.0, 8.0, 9, 12.5], ['Bathroom', 6.6, 6.4, 9, 8.0], ['Hall', 4.0, 6.4, 6.6, 8.0]],
    open: [[0, 6.4, 0, 6.4], [5.6, 4.0, 5.6, 6.4], [5.6, 6.4, 6.6, 6.4], [5.6, 1.2, 5.6, 2.1], [4.0, 6.6, 4.0, 7.4], [4.8, 8.0, 5.6, 8.0], [4.0, 9.8, 4.0, 10.6], [6.6, 6.45, 6.6, 7.2]],
    furn: [['sofa', .4, .6, 3.0, 1.0], ['rug', .6, 1.7, 2.6, 1.8], ['ctable', 1.4, 2.0, 1.1, .65], ['table', 1.0, 4.2, 2.0, 1.0, 0, 6], ['kitchen', 6.7, 5.75, 2.25, .62], ['island', 6.4, 4.3, 1.9, .8], ['desk', 6.6, .25, 1.5, .7], ['wardrobe', 8.35, .5, .6, 2.0], ['bed', 5.9, 10.3, 1.8, 2.1], ['side', 5.4, 11.85, .45, .4], ['side', 7.75, 11.85, .45, .4], ['wardrobe', 4.1, 8.1, .6, 1.6], ['bed', 1.2, 10.4, 1.4, 2.0], ['wardrobe', 3.35, 10.75, .6, 1.6], ['bed', .2, 6.6, 1.0, 1.9], ['desk', 1.5, 8.0, 1.3, .55], ['bath', 7.2, 7.25, 1.7, .7], ['sink', 7.4, 6.45, .6, .45], ['wc', 8.45, 6.45, .4, .5], ['plant', 5.1, .3], ['plant', .3, 5.9]]
  }
};
