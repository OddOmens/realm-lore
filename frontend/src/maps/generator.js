// Continent generator for the map builder.
//
// Paints one landmass (or a scatter of islands) into a Terrain from layered
// noise: a warped, falloff-shaped elevation field decides land and sea,
// ridged noise lays out mountain ranges, and moisture plus temperature pick
// the biome of every land cell. Rivers are traced downhill from the high
// ground to the sea or a lake. The same seed always gives the same land.

import { CELL, BIOME, hash2, valueNoise, fbm } from './terrain';

export const GENERATOR_SHAPES = [
  { value: 'continent',   label: 'Continent',   size: 9000 },
  { value: 'island',      label: 'Island',      size: 3000 },
  { value: 'archipelago', label: 'Archipelago', size: 7000 },
];

export const GENERATOR_CLIMATES = [
  { value: 'temperate', label: 'Temperate' },
  { value: 'varied',    label: 'Varied (cold north, hot south)' },
  { value: 'arid',      label: 'Arid' },
  { value: 'cold',      label: 'Cold' },
  { value: 'tropical',  label: 'Tropical' },
];

const SEA = 0.5;
const STEP = 2; // noise fields are sampled every STEP cells, then interpolated

// Ridged noise: 1 along thin crests, falling off either side.
function ridged(x, y, seed, octaves = 4) {
  let sum = 0, amp = 0.5, norm = 0, f = 1, weight = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(valueNoise(x * f, y * f, seed + i * 53) * 2 - 1);
    n *= n * weight;
    weight = Math.min(1, n * 1.6);
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / norm;
}

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPE = {
  // freq: noise frequency over the landmass; falloff: how hard the edge pulls
  // the land under the sea; lift: overall land amount; warp: coastline chaos.
  continent:   { freq: 2.2, contrast: 1.3, falloff: 1.25, lift: 0.56, warp: 0.42, rivers: 10, minRiver: 30 },
  island:      { freq: 2.0, contrast: 1.2, falloff: 1.45, lift: 0.55, warp: 0.35, rivers: 5, minRiver: 18 },
  archipelago: { freq: 3.4, contrast: 2.8, falloff: 0.9, lift: 0.31, warp: 0.32, rivers: 7, minRiver: 12 },
};

const CLIMATE = {
  //            moisture shift, temperature shift, latitude influence
  temperate: { m: 0.00, t: 0.00, lat: 0.25 },
  varied:    { m: 0.00, t: 0.00, lat: 0.85 },
  arid:      { m: -0.24, t: 0.15, lat: 0.20 },
  cold:      { m: 0.02, t: -0.34, lat: 0.25 },
  tropical:  { m: 0.18, t: 0.30, lat: 0.15 },
};

/**
 * Paints a landmass into `terrain` centred at world (cx, cy).
 * opts: { shape, size (world-unit diameter), seed, climate, rivers }
 * Returns { dirty, paths, places }; paths holds river features when asked.
 */
export function generateLand(terrain, cx, cy, opts = {}) {
  const shapeKey = SHAPE[opts.shape] ? opts.shape : 'continent';
  const shape = SHAPE[shapeKey];
  const climate = CLIMATE[opts.climate] || CLIMATE.temperate;
  const size = opts.size || GENERATOR_SHAPES.find(s => s.value === shapeKey).size;
  const seed = (opts.seed ?? Math.floor(Math.random() * 1e9)) | 0;
  const rng = makeRng(seed);
  const R = size / 2;

  // Random stretch and rotation so landmasses aren't round.
  const aspect = shapeKey === 'archipelago' ? 0.8 + rng() * 0.2 : 0.62 + rng() * 0.33;
  const rot = rng() * Math.PI;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  const s1 = seed % 100000, s2 = s1 + 1013, s3 = s1 + 2027, s4 = s1 + 3041, s5 = s1 + 4057, s6 = s1 + 5077;
  // Offset noise lookups by seed so different seeds sample different terrain.
  const ox = rng() * 1000, oy = rng() * 1000;

  // Sample grid covering the footprint plus a margin for the warp.
  const reach = R * 1.25;
  const gx0 = Math.floor((cx - reach) / CELL), gy0 = Math.floor((cy - reach) / CELL);
  const gx1 = Math.ceil((cx + reach) / CELL), gy1 = Math.ceil((cy + reach) / CELL);
  const sw = Math.ceil((gx1 - gx0) / STEP) + 2, sh = Math.ceil((gy1 - gy0) / STEP) + 2;
  const elev = new Float32Array(sw * sh);
  const ridge = new Float32Array(sw * sh);
  const moist = new Float32Array(sw * sh);
  const temp = new Float32Array(sw * sh);

  for (let j = 0; j < sh; j++) {
    for (let i = 0; i < sw; i++) {
      const wx = (gx0 + i * STEP + 0.5) * CELL, wy = (gy0 + j * STEP + 0.5) * CELL;
      // Normalised, rotated, stretched coordinates (|p| ≈ 1 at the rim).
      const dx = (wx - cx) / R, dy = (wy - cy) / R;
      let u = (dx * cosR - dy * sinR), v = (dx * sinR + dy * cosR) / aspect;
      // Domain warp: bends the coast into bays and peninsulas.
      const wu = fbm(u * 1.4 + ox, v * 1.4 + oy, s1, 3) - 0.5;
      const wv = fbm(u * 1.4 + ox + 31.7, v * 1.4 + oy - 17.3, s2, 3) - 0.5;
      u += wu * shape.warp * 2;
      v += wv * shape.warp * 2;
      const d = Math.sqrt(u * u + v * v);
      // Value-noise fbm bunches around 0.5; contrast spreads it so the sea
      // cuts in (an archipelago needs a lot of that).
      const base = (fbm(u * shape.freq + ox, v * shape.freq + oy, s3, 5) - 0.5) * shape.contrast + 0.5;
      const fall = Math.pow(d, 2.2) * shape.falloff;
      let e = base * 0.95 + shape.lift - fall * 0.62;
      // Ranges: ridged crests, only well inland, bent by the warp into long
      // sinuous chains rather than blobs.
      const rg = ridged(u * 1.9 + wu * 1.2 + ox, v * 1.9 + wv * 1.2 + oy, s4, 4);
      const inland = Math.max(0, Math.min(1, (e - SEA) * 6));
      const r = rg * inland;
      e += Math.max(0, r - 0.45) * 0.55;
      // Hard edge on the raw distance so land never reaches the footprint's square rim.
      const dRaw = Math.sqrt(dx * dx + dy * dy);
      if (dRaw > 0.9) e -= Math.min(1, (dRaw - 0.9) / 0.3) * 0.8;
      const k = j * sw + i;
      elev[k] = e;
      ridge[k] = r;
      // Coasts are wetter; noise makes rain shadows and dry interiors.
      const coast = Math.max(0, 1 - (e - SEA) * 7);
      moist[k] = fbm(u * 2.4 + ox + 70, v * 2.4 + oy, s5, 4) * 0.85 + coast * 0.22 + climate.m;
      // Latitude runs along world y: north (up) is colder.
      const lat = (wy - cy) / R; // -1 north … +1 south
      temp[k] = 0.55 + lat * 0.5 * climate.lat + climate.t
        - Math.max(0, r - 0.66) * 1.1 - Math.min(0.3, Math.max(0, e - SEA)) * 0.25
        + (fbm(u * 1.8 + ox - 40, v * 1.8 + oy, s6, 3) - 0.5) * 0.35;
    }
  }

  const sample = (arr, gx, gy) => {
    const fx = (gx - gx0) / STEP, fy = (gy - gy0) / STEP;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const a = arr[j * sw + i], b = arr[j * sw + i + 1];
    const c = arr[(j + 1) * sw + i], d = arr[(j + 1) * sw + i + 1];
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  };

  // Lakes: a handful of basins in wet lowland.
  const lakeSeed = s1 + 6091;
  const farmSeed = s1 + 7103;
  const detailSeed = s1 + 8111;

  const biomeAt = (gx, gy) => {
    const wx = (gx + 0.5) * CELL, wy = (gy + 0.5) * CELL;
    // Fine detail roughens the coast below the sample grid's resolution.
    const detail = (valueNoise(wx / 40, wy / 40, detailSeed) - 0.5) * 0.035
      + (valueNoise(wx / 13, wy / 13, detailSeed + 1) - 0.5) * 0.012;
    const e = sample(elev, gx, gy) + detail;
    if (e < SEA) return -1;
    const r = sample(ridge, gx, gy);
    const m = sample(moist, gx, gy);
    const t = sample(temp, gx, gy);
    const h = e - SEA;

    if (r > 0.68 && h > 0.06) return t < 0.18 || (r > 0.8 && t < 0.3) ? BIOME.SNOW : BIOME.MOUNTAINS;
    if (t < 0.12) return BIOME.SNOW;
    if (r > 0.58 && h > 0.04) return BIOME.HILLS;

    const lk = fbm(wx / 900 + ox, wy / 900 + oy, lakeSeed, 3);
    if (lk > 0.7 && h > 0.035 && h < 0.2 && m > 0.38) return BIOME.LAKE;

    if (m < 0.3) {
      if (t > 0.42) return m < 0.2 && t > 0.7 && r > 0.3 ? BIOME.BADLANDS : BIOME.DESERT;
      return t < 0.3 ? BIOME.SNOW : BIOME.GRASS;
    }
    if (m > 0.66 && h < 0.045) return BIOME.SWAMP;
    if (m > 0.51) return t > 0.68 ? BIOME.JUNGLE : BIOME.FOREST;
    if (m > 0.47 && t > 0.82) return BIOME.JUNGLE;
    const farm = fbm(wx / 600 + ox, wy / 600 + oy, farmSeed, 3);
    if (farm > 0.63 && h < 0.16 && t > 0.3) return BIOME.FARMLAND;
    return BIOME.GRASS;
  };

  const dirty = terrain.fillRect(gx0, gy0, gx1, gy1, biomeAt);

  const paths = opts.rivers ? traceRivers({
    terrain, elev, sw, sh, gx0, gy0, rng, count: shape.rivers, minLen: shape.minRiver, seed,
  }) : [];

  return { dirty, paths, places: [] };
}

// ── Rivers ────────────────────────────────────────────────────────────────────

function traceRivers({ terrain, elev, sw, sh, gx0, gy0, rng, count, minLen, seed }) {
  const n = sw * sh;
  const centre = (k) => [(gx0 + (k % sw) * STEP + STEP / 2) * CELL, (gy0 + Math.floor(k / sw) * STEP + STEP / 2) * CELL];
  const water = new Uint8Array(n); // 1 ocean, 2 lake
  for (let k = 0; k < n; k++) {
    const [wx, wy] = centre(k);
    const b = terrain.at(wx, wy);
    water[k] = b === BIOME.OCEAN ? 1 : b === BIOME.LAKE ? 2 : 0;
  }

  // Priority flood from the sea: every land sample gets a downstream
  // neighbour on a pit-free route to the coast, so rivers can't loop or
  // strand in a basin.
  const down = new Int32Array(n).fill(-1);
  const filled = new Float32Array(n);
  const done = new Uint8Array(n);
  const heap = new MinHeap(n);
  for (let k = 0; k < n; k++) {
    const i = k % sw, j = Math.floor(k / sw);
    if (water[k] === 1 || i === 0 || j === 0 || i === sw - 1 || j === sh - 1) {
      done[k] = 1;
      filled[k] = elev[k];
      heap.push(k, elev[k]);
    }
  }
  const dirs = [1, -1, sw, -sw, sw + 1, sw - 1, -sw + 1, -sw - 1];
  while (heap.size) {
    const k = heap.pop();
    const i = k % sw;
    for (const d of dirs) {
      const nk = k + d;
      if (nk < 0 || nk >= n || done[nk]) continue;
      const ni = nk % sw;
      if (Math.abs(ni - i) > 1) continue; // wrapped across a row edge
      done[nk] = 1;
      down[nk] = k;
      // Tiny jitter breaks ties on flats so courses aren't ruler-straight.
      filled[nk] = Math.max(elev[nk], filled[k] + 1e-5 + hash2(nk, 1, seed) * 2e-5);
      heap.push(nk, filled[nk]);
    }
  }

  // Sources: high ground, spread out, longest routes first.
  const candidates = [];
  for (let k = 0; k < n; k++) {
    if (water[k] || elev[k] < SEA + 0.12) continue;
    if (hash2(k, 7, seed) > 0.08) continue; // thin the candidates out
    candidates.push([k, elev[k] + rng() * 0.1]);
  }
  candidates.sort((a, b) => b[1] - a[1]);

  const used = new Uint8Array(n);
  const rivers = [];
  const minGap = Math.max(16, Math.sqrt(n) / 7);
  const picked = [];
  for (const [src] of candidates) {
    if (rivers.length >= count) break;
    const si = src % sw, sj = Math.floor(src / sw);
    if (picked.some(([pi, pj]) => Math.hypot(pi - si, pj - sj) < minGap)) continue;
    const cells = [src];
    let k = src, merged = false;
    while (down[k] >= 0) {
      k = down[k];
      cells.push(k);
      if (water[k]) break;
      if (used[k]) { merged = true; break; }
    }
    if (cells.length < minLen || (!merged && !water[k])) continue;
    picked.push([si, sj]);
    for (const c of cells) used[c] = 1;
    let pts = cells.map(centre);
    pts = meander(simplify(pts, CELL * 1.6), seed + rivers.length);
    rivers.push({
      id: `river-${seed}-${rivers.length}`,
      kind: 'river',
      points: pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
      width: 6 + Math.round(rng() * 4),
    });
  }
  return rivers;
}

// Binary min-heap of integer ids keyed by float priority.
class MinHeap {
  constructor(cap) { this.ids = new Int32Array(cap); this.keys = new Float32Array(cap); this.size = 0; }
  push(id, key) {
    let i = this.size++;
    this.ids[i] = id; this.keys[i] = key;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this._swap(i, p);
      i = p;
    }
  }
  pop() {
    const top = this.ids[0];
    const last = --this.size;
    if (last > 0) {
      this.ids[0] = this.ids[last]; this.keys[0] = this.keys[last];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.size && this.keys[l] < this.keys[m]) m = l;
        if (r < this.size && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this._swap(i, m);
        i = m;
      }
    }
    return top;
  }
  _swap(a, b) {
    const ti = this.ids[a]; this.ids[a] = this.ids[b]; this.ids[b] = ti;
    const tk = this.keys[a]; this.keys[a] = this.keys[b]; this.keys[b] = tk;
  }
}

// Ramer–Douglas–Peucker.
function simplify(points, tol) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const qx = ax + t * dx - px, qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2 && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

// Adds gentle bends between kept points so rivers wander like rivers.
function meander(points, seed) {
  if (points.length < 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len > CELL * 5) {
      const nx = -(by - ay) / len, ny = (bx - ax) / len;
      const off = (hash2(i, 3, seed) - 0.5) * len * 0.35;
      out.push([(ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off]);
    }
    out.push(points[i]);
  }
  return out;
}
