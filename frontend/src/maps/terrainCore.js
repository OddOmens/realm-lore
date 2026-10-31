// Builds terrain chunk bitmaps: the raster pass (biome fills, coast and echo
// lines, hillshade, farmland, city walls) and the ink symbols on top.
//
// This module is shared by the main thread and the terrain workers, so it
// never touches the DOM: canvases come from makeCanvas (an OffscreenCanvas
// where available). `terrain` only needs `chunks` (Map key → Uint8Array) and
// `cell(gx, gy)`, which lets a worker pass its own mirror of the chunks.

import { CELL, CHUNK, CHUNK_SIZE, BIOME, isWater, hash2, valueNoise, chunkKey } from './terrain';

// In a worker, chunk canvases are kept in memory (CPU) rather than on the
// GPU: building one is thousands of pixel writes and small sprite stamps,
// which a GPU-backed canvas makes many times slower.
const IN_WORKER = typeof window === 'undefined';
const CTX_OPTS = IN_WORKER ? { willReadFrequently: true } : undefined;
export const ctx2d = (canvas) => canvas.getContext('2d', CTX_OPTS);

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export const PAPER = {
  sea: '#9ab8b9',
  shallow: '#cddfd5',
  lake: '#abc8c6',
  ink: '#4a3b2c',
  paper: '#efe6c9',
  // Land fills by biome id (ocean and lake show their water colour).
  biome: [
    '#9ab8b9', // 0 ocean
    '#ded9a5', // 1 grassland
    '#b8c389', // 2 forest
    '#9fb77a', // 3 jungle
    '#edd498', // 4 desert
    '#d9c391', // 5 hills
    '#cdbb98', // 6 mountains
    '#f3f1ea', // 7 snow
    '#bcc198', // 8 swamp
    '#abc8c6', // 9 lake
    '#daa67d', // 10 badlands
    '#e2d592', // 11 farmland
    '#d8ccb2', // 12 city: paved, between the roofs
    '#e2d8b2', // 13 town
  ],
  // Fills used inside the ink symbols.
  crown: '#9aae6c',
  crownShade: '#86995c',
  conifer: '#86a062',
  jungleCrown: '#86a862',
  jungleShade: '#6c8f4c',
  mountainLit: '#dccdaa',
  mountainShade: '#a8977a',
  snowCap: '#f8f7f2',
  snowShade: '#cdd4d8',
  hillLit: '#dfcb98',
  hillShade: '#cdb685',
  duneShade: '#d8b977',
  reed: '#6f7f55',
  mesa: '#c98d63',
  mesaShade: '#a96f4c',
  roof: '#b9886a',
  roofShade: '#9c6f55',
  wall: '#efe6cf',
  // the textured sea background
  seaDeep: '#86a6aa',
  seaLight: '#b2cbc8',
  wave: '#5d7f84',
};

const CITY = BIOME.CITY, FARM = BIOME.FARMLAND, MOUNT = BIOME.MOUNTAINS, HILL = BIOME.HILLS, SNOWB = BIOME.SNOW;

// Farm fields: size along and across the furrows (world units) and tints.
const FIELD_U = 34, FIELD_V = 24;
const FIELD_TINTS = ['#e3d690', '#d9d48f', '#e6d08b', '#ddd096', '#d6d396', '#e5d89c', '#e0cf8a'].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

const M = 10;                // margin cells read from neighbours (≥ widest blur reach + 1)
const S = CHUNK + 2 * M;     // side of the sampled grid
const DETAIL_LEVEL = 4;      // echo lines, grain and coast wobble from here up

export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SHALLOW = hex(PAPER.shallow), LAKE_C = hex(PAPER.lake), INK = hex(PAPER.ink), WALL = hex('#e4dac2');
const FILL = PAPER.biome.map(hex);
const NB = PAPER.biome.length;
const OCEAN = BIOME.OCEAN, LAKE = BIOME.LAKE;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Separable box blur (running sums, edges clamped), `passes` times, radius r,
// on an S×S field.
function blur(src, r, passes) {
  const inv = 1 / (2 * r + 1);
  const tmp = new Float32Array(S * S);
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const dst = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      const row = y * S;
      let sum = cur[row] * (r + 1);
      for (let k = 1; k <= r; k++) sum += cur[row + Math.min(k, S - 1)];
      for (let x = 0; x < S; x++) {
        tmp[row + x] = sum * inv;
        sum += cur[row + Math.min(x + r + 1, S - 1)] - cur[row + Math.max(x - r, 0)];
      }
    }
    for (let x = 0; x < S; x++) {
      let sum = tmp[x] * (r + 1);
      for (let k = 1; k <= r; k++) sum += tmp[Math.min(k, S - 1) * S + x];
      for (let y = 0; y < S; y++) {
        dst[y * S + x] = sum * inv;
        sum += tmp[Math.min(y + r + 1, S - 1) * S + x] - tmp[Math.max(y - r, 0) * S + x];
      }
    }
    cur = dst;
  }
  return cur;
}

// Reads cells around chunk (cx, cy) from its 3×3 block of chunks (falling back
// to terrain.cell further out). Everything here depends only on world
// coordinates, so neighbouring chunks agree exactly and never show seams.
function makeReader(terrain, cx, cy) {
  const arrs = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) arrs.push(terrain.chunks.get(chunkKey(cx + dx, cy + dy)) || null);
  }
  const bx = cx * CHUNK, by = cy * CHUNK;
  const raw = (gx, gy) => {
    const lx = gx - bx, ly = gy - by;
    if (lx < -CHUNK || ly < -CHUNK || lx >= 2 * CHUNK || ly >= 2 * CHUNK) return terrain.cell(gx, gy);
    const ox = lx < 0 ? 0 : lx >= CHUNK ? 2 : 1, oy = ly < 0 ? 0 : ly >= CHUNK ? 2 : 1;
    const a = arrs[oy * 3 + ox];
    return a ? a[(ly - (oy - 1) * CHUNK) * CHUNK + (lx - (ox - 1) * CHUNK)] : 0;
  };
  // Land biomes are read through a small noise warp so borders between them
  // wander naturally instead of following brush or grid lines. Water and the
  // coastline are never warped.
  const biome = (gx, gy) => {
    const v = raw(gx, gy);
    if (isWater(v)) return v;
    // Deep inside one biome the warp can't change anything; skip the noise.
    if (raw(gx + 4, gy) === v && raw(gx - 4, gy) === v && raw(gx, gy + 4) === v && raw(gx, gy - 4) === v &&
        raw(gx + 3, gy + 3) === v && raw(gx - 3, gy - 3) === v && raw(gx + 3, gy - 3) === v && raw(gx - 3, gy + 3) === v) return v;
    const wx = Math.round((valueNoise(gx / 6, gy / 6, 71) - 0.5) * 5 + (valueNoise(gx / 2.5, gy / 2.5, 72) - 0.5) * 1.5);
    const wy = Math.round((valueNoise(gx / 6, gy / 6, 83) - 0.5) * 5 + (valueNoise(gx / 2.5, gy / 2.5, 84) - 0.5) * 1.5);
    if (!wx && !wy) return v;
    const t = raw(gx + wx, gy + wy);
    return isWater(t) ? v : t;
  };
  return { raw, biome };
}

// Samples the chunk plus a margin into an S×S grid of (warped) biomes.
function sampleGrid(reader, cx, cy) {
  const g = new Uint8Array(S * S);
  const counts = new Int32Array(NB);
  const gx0 = cx * CHUNK - M, gy0 = cy * CHUNK - M;
  let anyLand = false;
  for (let j = 0; j < S && !anyLand; j++) {
    for (let i = 0; i < S; i++) if (!isWater(reader.raw(gx0 + i, gy0 + j)) || reader.raw(gx0 + i, gy0 + j) === LAKE) { anyLand = true; break; }
  }
  if (!anyLand) { counts[OCEAN] = S * S; return { g, counts }; }
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const v = reader.biome(gx0 + i, gy0 + j);
      g[j * S + i] = v;
      if (v < NB) counts[v]++;
    }
  }
  return { g, counts };
}

// ── Raster pass ───────────────────────────────────────────────────────────────

// Paper grain: a fixed 64×64 table of small brightness offsets.
const GRAIN = (() => {
  const t = new Float32Array(64 * 64);
  for (let i = 0; i < t.length; i++) t[i] = (hash2(i & 63, i >> 6, 5) - 0.5) * 5;
  return t;
})();

const Q_FULL = 0, Q_UNIFORM = 1, Q_WATER = 2, Q_LAND = 3;

function rasterChunk(reader, cx, cy, L) {
  const { g, counts } = sampleGrid(reader, cx, cy);
  if (counts[OCEAN] === S * S) return null; // open sea: the background covers it

  // One-hot fields, lightly blurred, for every biome present.
  const present = [];
  for (let b = 0; b < NB; b++) if (counts[b]) present.push(b);
  const BW = new Array(NB).fill(null);
  for (const b of present) {
    const f = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) if (g[i] === b) f[i] = 1;
    BW[b] = blur(f, 1, 2);
  }
  const landRaw = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) if (!isWater(g[i])) landRaw[i] = 1;
  const LW = blur(landRaw, 1, 2);
  const WW = blur(landRaw, 4, 2); // wide (reaches 8 cells): shallow band and echo lines
  const OW = BW[OCEAN], KW = BW[LAKE];

  // Low-frequency mottle anchored to world cells, in RGB steps, plus relief:
  // land darkens toward the middle of mountains and hills and their slopes
  // are lit from the north-west, like a soft hand-washed hillshade.
  const MOT = new Float32Array(S * S);
  const gx0 = cx * CHUNK - M, gy0 = cy * CHUNK - M;
  for (let j = 0; j < S && L > 2; j++) {
    for (let i = 0; i < S; i++) {
      MOT[j * S + i] = (valueNoise((gx0 + i) / 13, (gy0 + j) / 13, 911) - 0.5) * 9
        + (valueNoise((gx0 + i) / 5, (gy0 + j) / 5, 912) - 0.5) * 4
        + (valueNoise((gx0 + i) / 41, (gy0 + j) / 41, 913) - 0.5) * 10;
    }
  }
  if (counts[MOUNT] || counts[HILL] || counts[SNOWB]) {
    const rel = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const v = g[i];
      rel[i] = v === MOUNT ? 1 : v === SNOWB ? 0.7 : v === HILL ? 0.45 : 0;
    }
    const RB = blur(rel, 3, 2);
    for (let j = 1; j < S - 1; j++) {
      for (let i = 1; i < S - 1; i++) {
        const k = j * S + i;
        MOT[k] += (RB[k + 1] - RB[k - 1] + RB[k + S] - RB[k - S]) * 30 - RB[k] * 8;
      }
    }
  }

  // Per-sample class: biome id + 1 when purely that land biome, 200 for open
  // ocean, 201 for the middle of a lake.
  const landBiomes = present.filter(b => !isWater(b));
  const code = new Int16Array(S * S);
  for (let i = 0; i < S * S; i++) {
    if (LW[i] >= 0.9999) {
      for (const b of landBiomes) if (BW[b][i] >= 0.9999) { code[i] = b + 1; break; }
    } else if (LW[i] <= 0 && WW[i] <= 0 && OW && OW[i] >= 0.9999) {
      code[i] = 200;
    } else if (LW[i] <= 0 && KW && KW[i] >= 0.9999) {
      code[i] = 201;
    }
  }
  // Per-quad class (quad = the square between four neighbouring samples).
  const qclass = new Uint8Array(S * S);
  for (let j = 0; j < S - 1; j++) {
    for (let i = 0; i < S - 1; i++) {
      const a = j * S + i, b = a + 1, c = a + S, d = c + 1;
      const ca = code[a];
      // Farmland is never flat-filled: its fields are drawn per pixel.
      if (ca && ca === code[b] && ca === code[c] && ca === code[d]) qclass[a] = ca - 1 === FARM ? Q_LAND : Q_UNIFORM;
      else if (LW[a] <= 0 && LW[b] <= 0 && LW[c] <= 0 && LW[d] <= 0) qclass[a] = Q_WATER;
      else if (LW[a] >= 0.9999 && LW[b] >= 0.9999 && LW[c] >= 0.9999 && LW[d] >= 0.9999) qclass[a] = Q_LAND;
      else qclass[a] = Q_FULL;
    }
  }


  const W = CHUNK * L;
  const canvas = makeCanvas(W, W);
  const ctx = ctx2d(canvas);
  const img = ctx.createImageData(W, W);
  const px32 = new Uint32Array(img.data.buffer);

  // Column → sample index and fraction.
  // Pixels are walked quad by quad: QS[i]..QE[i] are the pixel columns (and
  // rows) whose sample index is i.
  const I0 = new Int32Array(W), FX = new Float32Array(W);
  const QS = new Int32Array(S).fill(0), QE = new Int32Array(S).fill(0);
  for (let p = 0; p < W; p++) {
    const u = (p + 0.5) / L - 0.5 + M;
    const i0 = Math.floor(u);
    I0[p] = i0; FX[p] = u - i0;
    if (p === 0 || I0[p - 1] !== i0) QS[i0] = p;
    QE[i0] = p + 1;
  }
  const qFirst = I0[0], qLast = I0[W - 1];
  const lakePacked = (255 << 24) | (LAKE_C[2] << 16) | (LAKE_C[1] << 8) | LAKE_C[0];

  const coastHW = Math.max(1.1, 1.35 * L / 8) / 2;
  const echoHW = Math.max(0.8, 0.9 * L / 8) / 2;
  const rimPx = Math.max(1.5, L * 0.7); // darker land rim inside the coast
  const detailed = L >= DETAIL_LEVEL;
  const grain = L >= 4;
  const worldX0 = (cx * CHUNK - M + 0.5) * CELL, worldY0 = (cy * CHUNK - M + 0.5) * CELL;
  const sh0 = SHALLOW[0], sh1 = SHALLOW[1], sh2 = SHALLOW[2];
  const ink0 = INK[0], ink1 = INK[1], ink2 = INK[2];
  const nLand = landBiomes.length;
  const CW = BW[CITY];
  const FW = BW[FARM];
  const wallHW = Math.max(1.1, 1.6 * L / 8) / 2;
  const wallThick = L >= 8 ? Math.max(2.5, L * 0.34) : 0; // a double-lined wall up close
  const hedgeHW = Math.max(0.5, L / 16);

  // Helpers write their result into these (plain locals captured by closures
  // would live in a heap context and slow the pixel loop down).
  // wc4: water colour and alpha (open sea is see-through: the textured sea
  // background shows through it). lc3: land colour.
  const wc4 = new Float32Array(4), lc3 = new Float32Array(3);

  const water = (a, b, c, d, fx, fy) => {
    const lakeW = KW ? (KW[a] + (KW[b] - KW[a]) * fx) * (1 - fy) + (KW[c] + (KW[d] - KW[c]) * fx) * fy : 0;
    const oceanW = OW ? (OW[a] + (OW[b] - OW[a]) * fx) * (1 - fy) + (OW[c] + (OW[d] - OW[c]) * fx) * fy : 0;
    if (lakeW > oceanW) { wc4[0] = LAKE_C[0]; wc4[1] = LAKE_C[1]; wc4[2] = LAKE_C[2]; wc4[3] = 1; return; }
    const wa = WW[a], wb = WW[b], wc = WW[c], wd = WW[d];
    const ww = (wa + (wb - wa) * fx) * (1 - fy) + (wc + (wd - wc) * fx) * fy;
    let al = smoothstep(0.02, 0.45, ww) * 0.92;
    let r = sh0, gg = sh1, bb = sh2;
    if (detailed && ww > 0.02) {
      const gxw = (wb - wa) * (1 - fy) + (wd - wc) * fy;
      const gyw = (wc - wa) * (1 - fx) + (wd - wb) * fx;
      const gw = Math.max(Math.sqrt(gxw * gxw + gyw * gyw), 0.004);
      const d1 = (ww > 0.3 ? ww - 0.3 : 0.3 - ww) * L / gw;
      const d2 = (ww > 0.075 ? ww - 0.075 : 0.075 - ww) * L / gw;
      const ink = Math.max(clamp01(echoHW + 0.5 - d1) * 0.4, clamp01(echoHW + 0.5 - d2) * 0.24);
      if (ink > 0) {
        const na = ink + al * (1 - ink);
        const k = al * (1 - ink);
        r = (ink0 * ink + r * k) / na; gg = (ink1 * ink + gg * k) / na; bb = (ink2 * ink + bb * k) / na;
        al = na;
      }
    }
    wc4[0] = r; wc4[1] = gg; wc4[2] = bb; wc4[3] = al;
  };

  // Land colour: strongest land biome, softly blended with the runner-up,
  // then farm fields and city walls, into lc3. (i0, j0) is the quad.
  const land = (a, b, c, d, fx, fy, i0, j0) => {
    let b1 = -1, w1 = -1, b2 = -1, w2 = -1;
    for (let k = 0; k < nLand; k++) {
      const bi = landBiomes[k], f = BW[bi];
      const w = (f[a] + (f[b] - f[a]) * fx) * (1 - fy) + (f[c] + (f[d] - f[c]) * fx) * fy;
      if (w > w1) { b2 = b1; w2 = w1; b1 = bi; w1 = w; } else if (w > w2) { b2 = bi; w2 = w; }
    }
    const c1 = FILL[b1 < 0 ? 1 : b1];
    if (b2 < 0) { lc3[0] = c1[0]; lc3[1] = c1[1]; lc3[2] = c1[2]; }
    else {
      const c2 = FILL[b2];
      const t = 0.5 + 0.5 * clamp01((w1 - w2) / 0.22);
      lc3[0] = c1[0] * t + c2[0] * (1 - t); lc3[1] = c1[1] * t + c2[1] * (1 - t); lc3[2] = c1[2] * t + c2[2] * (1 - t);
    }
    // Farmland: a patchwork of tinted fields with hedgerows (and furrows up close).
    if (FW) {
      const fw = (FW[a] + (FW[b] - FW[a]) * fx) * (1 - fy) + (FW[c] + (FW[d] - FW[c]) * fx) * fy;
      const fa = smoothstep(0.35, 0.65, fw);
      if (fa > 0) {
        const wx = worldX0 + (i0 + fx) * CELL, wy = worldY0 + (j0 + fy) * CELL;
        const ang = 0.35 + (valueNoise(wx / 3000, wy / 3000, 501) - 0.5) * 0.9;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        // hedges wander a little, so fields aren't a perfect grid
        const u = (wx * ca + wy * sa) / FIELD_U + (valueNoise(wx / 95, wy / 95, 503) - 0.5) * 0.7;
        const v = (wy * ca - wx * sa) / FIELD_V + (valueNoise(wx / 95, wy / 95, 504) - 0.5) * 0.7;
        const iu = Math.floor(u), iv = Math.floor(v);
        const tint = FIELD_TINTS[Math.floor(hash2(iu, iv, 77) * FIELD_TINTS.length)];
        let r = tint[0], gg = tint[1], bb = tint[2];
        if (L >= 4) {
          const du = Math.min(u - iu, 1 - (u - iu)) * FIELD_U, dv = Math.min(v - iv, 1 - (v - iv)) * FIELD_V;
          const dpx = Math.min(du, dv) * L / CELL; // distance to the field edge in pixels
          const hedge = clamp01(hedgeHW + 0.5 - dpx) * 0.24;
          let furrow = 0;
          if (L >= 8) {
            const along = hash2(iu, iv, 78) < 0.5 ? (u - iu) * FIELD_U : (v - iv) * FIELD_V;
            const ph = along / 3.2 - Math.floor(along / 3.2);
            furrow = ph < 0.3 ? 0.06 : 0;
          }
          const dk = hedge + furrow;
          r += (ink0 - r) * dk; gg += (ink1 - gg) * dk; bb += (ink2 - bb) * dk;
        }
        lc3[0] += (r - lc3[0]) * fa; lc3[1] += (gg - lc3[1]) * fa; lc3[2] += (bb - lc3[2]) * fa;
      }
    }
    // City walls: an ink line where city meets anything else; up close a
    // double line with stone between, so it reads as a wall.
    if (CW && L >= 2) {
      const ca = CW[a], cb = CW[b], cc = CW[c], cd = CW[d];
      if (ca !== cb || cb !== cc || cc !== cd) {
        const cw = (ca + (cb - ca) * fx) * (1 - fy) + (cc + (cd - cc) * fx) * fy;
        const gx = (cb - ca) * (1 - fy) + (cd - cc) * fy, gy = (cc - ca) * (1 - fx) + (cd - cb) * fx;
        const gl = Math.max(Math.sqrt(gx * gx + gy * gy), 0.02);
        const sd = (cw - 0.5) * L / gl; // >0 inside the city
        if (wallThick && sd > 0 && sd < wallThick) {
          const st = clamp01(Math.min(sd, wallThick - sd) + 0.5) * 0.9;
          lc3[0] += (WALL[0] - lc3[0]) * st; lc3[1] += (WALL[1] - lc3[1]) * st; lc3[2] += (WALL[2] - lc3[2]) * st;
        }
        let inkA = clamp01(wallHW + 0.5 - (sd < 0 ? -sd : sd)) * 0.9;
        if (wallThick) {
          const s2 = sd - wallThick;
          inkA = Math.max(inkA, clamp01(wallHW * 0.7 + 0.5 - (s2 < 0 ? -s2 : s2)) * 0.75);
        }
        if (inkA > 0) { lc3[0] += (ink0 - lc3[0]) * inkA; lc3[1] += (ink1 - lc3[1]) * inkA; lc3[2] += (ink2 - lc3[2]) * inkA; }
      }
    }
  };

  const put = (idx, r, gg, bb, al) => {
    const R = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    const G = gg < 0 ? 0 : gg > 255 ? 255 : gg | 0;
    const B = bb < 0 ? 0 : bb > 255 ? 255 : bb | 0;
    const A = al >= 1 ? 255 : al <= 0 ? 0 : (al * 255) | 0;
    px32[idx] = (A << 24) | (B << 16) | (G << 8) | R;
  };

  for (let j0 = qFirst; j0 <= qLast; j0++) {
    for (let py = QS[j0]; py < QE[j0]; py++) {
      const fy = FX[py];
      const rowA = j0 * S, rowB = rowA + S;
      const outRow = py * W;
      const grow = ((cy * W + py) & 63) << 6;
      for (let i0 = qFirst; i0 <= qLast; i0++) {
        const p0 = QS[i0], p1 = QE[i0];
        const a = rowA + i0, b = a + 1, c = rowB + i0, d = c + 1;
        const q = qclass[a];
        // Mottle along this row of the quad is linear in fx: m = mA + (mB - mA) * fx.
        const mA = MOT[a] + (MOT[c] - MOT[a]) * fy, mD = MOT[b] + (MOT[d] - MOT[b]) * fy - mA;

        if (q === Q_UNIFORM) {
          const ca = code[a];
          if (ca === 200) { px32.fill(0, outRow + p0, outRow + p1); continue; }
          if (ca === 201) { px32.fill(lakePacked, outRow + p0, outRow + p1); continue; }
          const col = FILL[ca - 1];
          const c0 = col[0], c1 = col[1], c2 = col[2];
          for (let p = p0; p < p1; p++) {
            const t = mA + mD * FX[p] + (grain ? GRAIN[grow | ((cx * W + p) & 63)] : 0);
            put(outRow + p, c0 + t, c1 + t, c2 + t * 0.8, 1);
          }
          continue;
        }

        for (let p = p0; p < p1; p++) {
          const fx = FX[p];
          const tex = mA + mD * fx + (grain ? GRAIN[grow | ((cx * W + p) & 63)] : 0);
          if (q === Q_WATER) {
            water(a, b, c, d, fx, fy);
            put(outRow + p, wc4[0], wc4[1], wc4[2], wc4[3]);
          } else if (q === Q_LAND) {
            land(a, b, c, d, fx, fy, i0, j0);
            put(outRow + p, lc3[0] + tex, lc3[1] + tex, lc3[2] + tex * 0.8, 1);
          } else {
            // Coast: land weight, its gradient and a wobble so the shore isn't too smooth.
            const la = LW[a], lbv = LW[b], lc = LW[c], ld = LW[d];
            let lw = (la + (lbv - la) * fx) * (1 - fy) + (lc + (ld - lc) * fx) * fy;
            const gxl = (lbv - la) * (1 - fy) + (ld - lc) * fy;
            const gyl = (lc - la) * (1 - fx) + (ld - lbv) * fx;
            let hw = coastHW;
            if (detailed && lw > 0.15 && lw < 0.85) {
              const wx = worldX0 + (i0 + fx) * CELL, wy = worldY0 + (j0 + fy) * CELL;
              lw += (valueNoise(wx * 0.06, wy * 0.06, 3) - 0.5) * 0.16 + (valueNoise(wx * 0.22, wy * 0.22, 4) - 0.5) * 0.06;
              // the pen presses harder in places
              hw *= 0.75 + valueNoise(wx * 0.012, wy * 0.012, 6) * 0.6;
            }
            const gl = Math.max(Math.sqrt(gxl * gxl + gyl * gyl), 0.02);
            const sd = (lw - 0.5) * L / gl; // signed distance to the coast, in pixels
            const landA = clamp01(sd + 0.5);
            let r = 0, gg = 0, bb = 0, al = 0;
            if (landA < 1) { water(a, b, c, d, fx, fy); r = wc4[0]; gg = wc4[1]; bb = wc4[2]; al = wc4[3]; }
            if (landA > 0) {
              land(a, b, c, d, fx, fy, i0, j0);
              const rim = sd > 0 ? (1 - clamp01(sd / rimPx)) * 0.1 : 0.1;
              const tr = (lc3[0] + tex) * (1 - rim), tg = (lc3[1] + tex) * (1 - rim), tb = (lc3[2] + tex * 0.8) * (1 - rim);
              const na = landA + al * (1 - landA);
              const k = al * (1 - landA);
              r = (tr * landA + r * k) / na; gg = (tg * landA + gg * k) / na; bb = (tb * landA + bb * k) / na;
              al = na;
            }
            const sdAbs = sd < 0 ? -sd : sd;
            const inkA = clamp01(hw + 0.5 - sdAbs) * 0.95;
            if (inkA > 0) {
              const na = inkA + al * (1 - inkA);
              const k = al * (1 - inkA);
              r = (ink0 * inkA + r * k) / na; gg = (ink1 * inkA + gg * k) / na; bb = (ink2 * inkA + bb * k) / na;
              al = na;
            }
            put(outRow + p, r, gg, bb, al);
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, ctx };
}

// ── Symbols ───────────────────────────────────────────────────────────────────

const lineW = (L) => Math.max(0.8, 9.6 / L); // ~1.2 px at every level, thinner in world terms up close

// Symbols are drawn around an anchor (x, y) at the base centre, s = size in
// world units, w = ink line width; h (0…1) picks a variant.

function circlesPath(ctx, circles) {
  ctx.beginPath();
  for (const [cx, cy, r] of circles) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
}

// A tree: a scalloped canopy of overlapping puffs, shaded low-right, on a short
// trunk; one variant in four is a conifer.
function treeSym(ctx, x, y, s, w, h) {
  if (h > 0.75) {
    ctx.lineWidth = w * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.16); ctx.stroke();
    const tiers = [[0.18, 0.42, 0.5], [0.42, 0.62, 0.38], [0.62, 0.95, 0.26]];
    for (const [b, t, hw] of tiers) {
      ctx.beginPath();
      ctx.moveTo(x - s * hw, y - s * b);
      ctx.lineTo(x, y - s * t);
      ctx.lineTo(x + s * hw, y - s * b);
      ctx.closePath();
      ctx.fillStyle = PAPER.conifer; ctx.fill(); ctx.stroke();
    }
    return;
  }
  const r = s * 0.27;
  const cy0 = y - s * 0.5;
  const lean = (h - 0.4) * r * 0.5;
  const puffs = [[x - r * 0.75 + lean, cy0 + r * 0.25, r * 0.85], [x + r * 0.75 + lean, cy0 + r * 0.3, r * 0.8], [x + lean * 1.5, cy0 - r * 0.45, r]];
  ctx.lineWidth = w * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.22); ctx.stroke();
  // outline: stroke every puff wide, then fill over the insides
  ctx.lineWidth = w * 1.5;
  circlesPath(ctx, puffs); ctx.stroke();
  ctx.fillStyle = PAPER.crown;
  circlesPath(ctx, puffs); ctx.fill();
  ctx.save();
  circlesPath(ctx, puffs); ctx.clip();
  ctx.fillStyle = PAPER.crownShade;
  ctx.beginPath();
  ctx.arc(x + r * 0.9 + lean, cy0 + r * 0.9, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Jungle: broad, dark canopies with palms among them.
function jungleSym(ctx, x, y, s, w, h) {
  if (h < 0.25) {
    const lean = (h - 0.25) * s;
    const tx = x + lean * 0.4, ty = y - s * 0.7;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.1, y - s * 0.4, tx, ty);
    ctx.stroke();
    ctx.fillStyle = PAPER.jungleCrown;
    ctx.lineWidth = w * 0.7;
    for (const [dx, dy] of [[-0.5, 0.14], [-0.34, -0.12], [0.36, -0.1], [0.52, 0.16], [0.02, -0.28]]) {
      const ex = tx + dx * s, ey = ty + dy * s;
      const mx = tx + dx * s * 0.5, my = ty + dy * s * 0.5 - s * 0.16;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(mx, my - s * 0.04, ex, ey);
      ctx.quadraticCurveTo(mx, my + s * 0.08, tx, ty);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  const r = s * 0.24;
  const cy0 = y - s * 0.42;
  const puffs = [[x - r * 1.0, cy0 + r * 0.3, r * 0.85], [x + r * 1.0, cy0 + r * 0.25, r * 0.9], [x - r * 0.35, cy0 - r * 0.5, r], [x + r * 0.5, cy0 - r * 0.55, r * 0.95]];
  ctx.lineWidth = w * 1.8;
  circlesPath(ctx, puffs); ctx.stroke();
  ctx.fillStyle = PAPER.jungleCrown;
  circlesPath(ctx, puffs); ctx.fill();
  ctx.save();
  circlesPath(ctx, puffs); ctx.clip();
  ctx.fillStyle = PAPER.jungleShade;
  ctx.beginPath();
  ctx.arc(x + r * 1.1, cy0 + r * 1.1, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Mountain silhouettes, as fractions of s from the base centre (y up is negative).
const PEAKS = [
  [[-0.56, 0], [-0.22, -0.52], [-0.02, -0.92], [0.22, -0.6], [0.32, -0.64], [0.58, 0]],     // classic with a shoulder
  [[-0.62, 0], [-0.32, -0.66], [-0.15, -0.5], [0.08, -0.95], [0.36, -0.52], [0.62, 0]],     // twin peaks
  [[-0.46, 0], [-0.14, -0.72], [-0.04, -1.08], [0.14, -0.8], [0.48, 0]],                    // spire
  [[-0.66, 0], [-0.4, -0.42], [-0.12, -0.78], [0.12, -0.72], [0.3, -0.5], [0.66, 0]],       // broad massif
];

// A mountain: lit west face, shaded east face, an inked silhouette and ridge,
// hatching on the shaded side, and a snowcap on high or cold peaks.
function mountainSym(ctx, x, y, s, w, h, snowy) {
  const pts = PEAKS[Math.min(PEAKS.length - 1, Math.floor(h * PEAKS.length))].map(([px, py]) => [x + px * s, y + py * s]);
  let top = 0;
  for (let k = 1; k < pts.length; k++) if (pts[k][1] < pts[top][1]) top = k;
  const [px, py] = pts[top];
  const footX = px + s * 0.1;
  const outline = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); };

  outline(); ctx.closePath();
  ctx.fillStyle = PAPER.mountainLit; ctx.fill();
  // shaded face: from the peak down the ridge to the base, then the east side
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.quadraticCurveTo(px + s * 0.12, py + (y - py) * 0.5, footX, y);
  ctx.lineTo(pts[pts.length - 1][0], y);
  for (let k = pts.length - 2; k > top; k--) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.closePath();
  ctx.fillStyle = PAPER.mountainShade; ctx.fill();

  if (snowy) {
    const capY = py + (y - py) * 0.38;
    ctx.save();
    outline(); ctx.closePath(); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x - s, capY);
    ctx.lineTo(px - s * 0.2, capY + s * 0.04);
    ctx.lineTo(px - s * 0.08, capY - s * 0.06);
    ctx.lineTo(px + s * 0.04, capY + s * 0.08);
    ctx.lineTo(px + s * 0.18, capY - s * 0.03);
    ctx.lineTo(x + s, capY + s * 0.02);
    ctx.lineTo(x + s, y - s * 2);
    ctx.lineTo(x - s, y - s * 2);
    ctx.closePath();
    ctx.fillStyle = PAPER.snowCap; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + s * 0.12, py + (y - py) * 0.5, footX, y);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s, py);
    ctx.closePath();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PAPER.snowShade; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.lineWidth = w;
  outline(); ctx.stroke();
  ctx.lineWidth = w * 0.7;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.quadraticCurveTo(px + s * 0.12, py + (y - py) * 0.5, footX - s * 0.02, y - s * 0.1);
  ctx.stroke();
  // hatching down the shaded face
  ctx.lineWidth = w * 0.5;
  ctx.beginPath();
  const rx = pts[pts.length - 1][0];
  for (let k = 1; k <= 4; k++) {
    const t = k / 5;
    const ax = px + (rx - px) * t * 0.9 + s * 0.04, ay = py + (y - py) * t;
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - s * 0.1, ay + s * 0.14);
  }
  ctx.stroke();
}

// A hill: a soft dome, lit left and shaded right, inked along its crest.
function hillSym(ctx, x, y, s, w) {
  const dome = () => { ctx.beginPath(); ctx.moveTo(x - s * 0.55, y); ctx.bezierCurveTo(x - s * 0.34, y - s * 0.46, x + s * 0.26, y - s * 0.5, x + s * 0.55, y); };
  dome(); ctx.closePath();
  ctx.fillStyle = PAPER.hillLit; ctx.fill();
  ctx.save();
  dome(); ctx.closePath(); ctx.clip();
  ctx.beginPath();
  ctx.ellipse(x + s * 0.46, y, s * 0.4, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = PAPER.hillShade; ctx.fill();
  ctx.restore();
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x - s * 0.55, y); ctx.bezierCurveTo(x - s * 0.34, y - s * 0.46, x + s * 0.26, y - s * 0.5, x + s * 0.55, y); ctx.stroke();
  ctx.lineWidth = w * 0.5;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y - s * 0.22); ctx.lineTo(x + s * 0.27, y - s * 0.08);
  ctx.moveTo(x + s * 0.34, y - s * 0.17); ctx.lineTo(x + s * 0.4, y - s * 0.05);
  ctx.stroke();
}

// A dune: a crescent with its slip face in shadow and a fine crest line.
function duneSym(ctx, x, y, s, w, h) {
  const flip = h < 0.5 ? 1 : -1;
  ctx.fillStyle = PAPER.duneShade;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55 * flip, y);
  ctx.quadraticCurveTo(x - s * 0.08 * flip, y - s * 0.42, x + s * 0.5 * flip, y - s * 0.08);
  ctx.quadraticCurveTo(x + s * 0.06 * flip, y - s * 0.16, x - s * 0.55 * flip, y);
  ctx.fill();
  ctx.lineWidth = w * 0.75;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55 * flip, y);
  ctx.quadraticCurveTo(x - s * 0.08 * flip, y - s * 0.42, x + s * 0.5 * flip, y - s * 0.08);
  ctx.stroke();
  ctx.lineWidth = w * 0.4;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3 * flip, y + s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.05 * flip, y - s * 0.06, x + s * 0.38 * flip, y + s * 0.05);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Swamp: a tuft of reeds over short strokes of standing water.
function swampSym(ctx, x, y, s, w, h) {
  ctx.strokeStyle = PAPER.reed;
  ctx.lineWidth = w * 0.7;
  ctx.beginPath();
  const n = 4 + Math.floor(h * 3);
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) - 0.5;
    const tall = 0.5 + ((k * 7) % 3) * 0.1;
    ctx.moveTo(x + t * s * 0.16, y);
    ctx.quadraticCurveTo(x + t * s * 0.18, y - s * tall * 0.6, x + t * s * 0.32, y - s * tall);
  }
  ctx.stroke();
  ctx.strokeStyle = PAPER.wave;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = w * 0.55;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.42, y + s * 0.08); ctx.lineTo(x - s * 0.08, y + s * 0.08);
  ctx.moveTo(x + s * 0.06, y + s * 0.08); ctx.lineTo(x + s * 0.4, y + s * 0.08);
  ctx.moveTo(x - s * 0.22, y + s * 0.2); ctx.lineTo(x + s * 0.2, y + s * 0.2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PAPER.ink;
}

// Snowfield: low drifts with a blue-grey shadow.
function snowSym(ctx, x, y, s, w) {
  ctx.fillStyle = PAPER.snowShade;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y);
  ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.32, x + s * 0.45, y - s * 0.02);
  ctx.quadraticCurveTo(x, y - s * 0.12, x - s * 0.5, y);
  ctx.fill();
  ctx.lineWidth = w * 0.6;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y);
  ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.32, x + s * 0.45, y - s * 0.02);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Badlands: a flat-topped mesa with banded, shaded sides.
function mesaSym(ctx, x, y, s, w, h) {
  const tw = 0.24 + h * 0.14;
  const body = () => { ctx.beginPath(); ctx.moveTo(x - s * 0.52, y); ctx.lineTo(x - s * tw, y - s * 0.44); ctx.lineTo(x + s * tw, y - s * 0.44); ctx.lineTo(x + s * 0.52, y); };
  body(); ctx.closePath();
  ctx.fillStyle = PAPER.mesa; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + s * tw * 0.4, y - s * 0.44); ctx.lineTo(x + s * tw, y - s * 0.44); ctx.lineTo(x + s * 0.52, y); ctx.lineTo(x + s * 0.12, y);
  ctx.closePath();
  ctx.fillStyle = PAPER.mesaShade; ctx.fill();
  ctx.lineWidth = w;
  body(); ctx.stroke();
  ctx.lineWidth = w * 0.45;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (const t of [0.35, 0.65]) {
    const yy = y - s * 0.44 * (1 - t);
    const half = tw + (0.52 - tw) * t;
    ctx.moveTo(x - s * half * 0.92, yy); ctx.lineTo(x + s * half * 0.92, yy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Grassland: an occasional faint tuft.
function grassSym(ctx, x, y, s, w) {
  ctx.lineWidth = w * 0.5;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.2, y - s * 0.22); ctx.quadraticCurveTo(x - s * 0.08, y - s * 0.05, x - s * 0.04, y);
  ctx.moveTo(x, y - s * 0.32); ctx.lineTo(x, y);
  ctx.moveTo(x + s * 0.18, y - s * 0.24); ctx.quadraticCurveTo(x + s * 0.08, y - s * 0.05, x + s * 0.04, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// A tower or spire rising over the roofs.
function towerSym(ctx, x, y, s, w) {
  ctx.lineWidth = w * 0.8;
  const bw = s * 0.32, bh = s * 0.7;
  ctx.beginPath();
  ctx.rect(x - bw / 2, y - bh, bw, bh);
  ctx.fillStyle = PAPER.wall; ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - bw / 2 - s * 0.05, y - bh);
  ctx.lineTo(x, y - bh - s * 0.42);
  ctx.lineTo(x + bw / 2 + s * 0.05, y - bh);
  ctx.closePath();
  ctx.fillStyle = PAPER.roofShade; ctx.fill(); ctx.stroke();
}

// A house: whitewashed walls under a gabled roof, shaded on one side; h varies the width.
function houseSym(ctx, x, y, s, w, h) {
  ctx.lineWidth = w * 0.8;
  const bw = s * (0.5 + h * 0.4), bh = s * 0.34, rh = s * 0.3;
  ctx.beginPath();
  ctx.rect(x - bw / 2, y - bh, bw, bh);
  ctx.fillStyle = PAPER.wall; ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - bw / 2 - s * 0.05, y - bh);
  ctx.lineTo(x - bw / 2 + s * 0.12, y - bh - rh);
  ctx.lineTo(x + bw / 2 - s * 0.12, y - bh - rh);
  ctx.lineTo(x + bw / 2 + s * 0.05, y - bh);
  ctx.closePath();
  ctx.fillStyle = PAPER.roof; ctx.fill(); ctx.stroke();
  // shaded far slope
  ctx.beginPath();
  ctx.moveTo(x + bw / 2 - s * 0.12, y - bh - rh);
  ctx.lineTo(x + bw / 2 + s * 0.05, y - bh);
  ctx.lineTo(x + bw * 0.15, y - bh);
  ctx.closePath();
  ctx.fillStyle = PAPER.roofShade; ctx.fill();
  // door
  ctx.beginPath();
  ctx.moveTo(x - s * 0.02, y);
  ctx.lineTo(x - s * 0.02, y - bh * 0.5);
  ctx.lineTo(x + s * 0.08, y - bh * 0.5);
  ctx.lineTo(x + s * 0.08, y);
  ctx.lineWidth = w * 0.5;
  ctx.stroke();
}

// How each biome scatters symbols at full detail: lattice step (cells), chance,
// size (world units), and how far (in symbol sizes) the footprint check reaches.
// At lower detail levels step and size grow together so symbols keep the same
// size on screen and simply thin out, as on an atlas.
// Farmland has no symbols: its fields are part of the raster.
const SCATTER = {
  [BIOME.FOREST]:    { step: 1, p: 0.7,  size: [12, 15], draw: 'tree', jitter: 0.45 },
  [BIOME.JUNGLE]:    { step: 1, p: 0.85, size: [14, 18], draw: 'jungle', jitter: 0.45 },
  [BIOME.MOUNTAINS]: { step: 3, p: 0.9,  size: [30, 38], draw: 'mountain', rowShift: true },
  [BIOME.HILLS]:     { step: 3, p: 0.5,  size: [17, 22], draw: 'hill', rowShift: true },
  [BIOME.DESERT]:    { step: 3, p: 0.5,  size: [15, 20], draw: 'dune', rowShift: true },
  [BIOME.SWAMP]:     { step: 2, p: 0.5,  size: [10, 13], draw: 'swamp' },
  [BIOME.SNOW]:      { step: 3, p: 0.35, size: [14, 18], draw: 'snow' },
  [BIOME.BADLANDS]:  { step: 3, p: 0.5,  size: [17, 22], draw: 'mesa' },
  [BIOME.GRASS]:     { step: 3, p: 0.12, size: [8, 10],  draw: 'grass' },
  // Cities pack roofs on a loose grid, leaving every fifth row and column as a street.
  [BIOME.CITY]:      { step: 1, p: 0.95, size: [9, 11], draw: 'house', streets: 5, jitter: 0.12 },
  [BIOME.TOWN]:      { step: 2, p: 0.45, size: [10, 12], draw: 'house' },
};
const SCATTER_LIST = Object.entries(SCATTER).map(([b, sc]) => ({ biome: Number(b), ...sc }));
// The odd tower over a city's roofs.
SCATTER_LIST.push({ biome: BIOME.CITY, step: 4, p: 0.2, size: [15, 18], draw: 'tower', streets: 0 });

// Mountains are sized by how deep into their range they stand, so ranges
// read as ranges: big peaks along the spine, foothills at the edges.
const RING = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
const RANGE_SIZE = [0.62, 0.8, 1.0, 1.22];

// Symbols are drawn once per (kind, variant, size, level) into a small sprite
// and stamped with drawImage, which is far faster than re-stroking thousands
// of paths per chunk.
const VARIANTS = 4;
const SIZE_BUCKETS = 3;
const spriteCache = new Map();

function drawGlyph(ctx, kind, s, w, h) {
  switch (kind) {
    case 'tree': treeSym(ctx, 0, 0, s, w, h); break;
    case 'jungle': jungleSym(ctx, 0, 0, s, w, h); break;
    case 'mountain': mountainSym(ctx, 0, 0, s, w, h, false); break;
    case 'mountainSnow': mountainSym(ctx, 0, 0, s, w, h, true); break;
    case 'hill': hillSym(ctx, 0, 0, s, w); break;
    case 'dune': duneSym(ctx, 0, 0, s, w, h); break;
    case 'swamp': swampSym(ctx, 0, 0, s, w, h); break;
    case 'snow': snowSym(ctx, 0, 0, s, w); break;
    case 'mesa': mesaSym(ctx, 0, 0, s, w, h); break;
    case 'grass': grassSym(ctx, 0, 0, s, w); break;
    case 'house': houseSym(ctx, 0, 0, s, w, h); break;
    case 'tower': towerSym(ctx, 0, 0, s, w); break;
  }
}

// → { canvas, ax, ay } with (ax, ay) the anchor in sprite pixels.
function sprite(kind, variant, s, L) {
  const key = `${kind}|${variant}|${s}|${L}`;
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const k = L / CELL;
  const w = lineW(L);
  const pad = w * 2;
  const left = s * 0.72 + pad, right = s * 0.72 + pad, top = s * 1.15 + pad, bottom = s * 0.35 + pad;
  const canvas = makeCanvas(Math.max(1, Math.ceil((left + right) * k)), Math.max(1, Math.ceil((top + bottom) * k)));
  const ctx = ctx2d(canvas);
  ctx.setTransform(k, 0, 0, k, left * k, top * k);
  ctx.strokeStyle = PAPER.ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawGlyph(ctx, kind, s, w, (variant + 0.5) / VARIANTS);
  sp = { canvas, ax: left * k, ay: top * k };
  spriteCache.set(key, sp);
  return sp;
}

function drawSymbols(ctx, reader, cx, cy, L) {
  const k = Math.max(1, CELL / L); // symbol scale for this detail level
  const list = [];
  const bx = cx * CHUNK, by = cy * CHUNK;
  // Footprint sample points, in symbol sizes from the anchor (base centre).
  const FOOT = [[0, 0], [-0.5, 0], [0.5, 0], [-0.3, -0.45], [0.3, -0.45], [0, -0.85]];
  for (const sc of SCATTER_LIST) {
    const step = Math.max(1, Math.round(sc.step * k));
    const maxSize = sc.size[1] * k;
    const ext = Math.ceil(maxSize * 1.15 / CELL) + step; // cells a symbol can reach past its anchor
    const gy0 = Math.floor((by - ext) / step) * step;
    for (let gy = gy0; gy < by + CHUNK + ext; gy += step) {
      const shift = sc.rowShift && (Math.floor(gy / step) & 1) ? Math.floor(step / 2) : 0;
      const gx0 = Math.floor((bx - ext - shift) / step) * step + shift;
      for (let gx = gx0; gx < bx + CHUNK + ext; gx += step) {
        // lattice points carry their own jitter, so judge them by the jittered spot
        if (sc.streets) {
          // Streets wander a little: offset the grid by low-frequency noise.
          const sx = Math.floor(gx / step + valueNoise(gx / step / 9, gy / step / 9, 71) * 2);
          const sy = Math.floor(gy / step + valueNoise(gx / step / 9, gy / step / 9, 73) * 2);
          if (sx % sc.streets === 0 || sy % sc.streets === 0) continue;
        }
        const h = hash2(gx, gy, 17 + sc.biome * 7 + step);
        if (h > sc.p) continue;
        const jit = step * CELL * (sc.jitter ?? 0.35);
        const x = (gx + 0.5) * CELL + (hash2(gx, gy, 31 + step) - 0.5) * 2 * jit;
        const y = (gy + 0.5) * CELL + (hash2(gx, gy, 47 + step) - 0.5) * 2 * jit;
        if (reader.biome(Math.floor(x / CELL), Math.floor(y / CELL)) !== sc.biome) continue;
        const bucket = Math.min(SIZE_BUCKETS - 1, Math.floor(hash2(gx, gy, 59) * SIZE_BUCKETS));
        let size = (sc.size[0] + (sc.size[1] - sc.size[0]) * (bucket + 0.5) / SIZE_BUCKETS) * k;
        if (sc.biome === CITY) {
          // Keep buildings tucked inside the walls: a clear strip (wider in
          // world terms when zoomed out, so it stays a few pixels on screen)
          // plus half a building between any roof and the wall line.
          const clear = Math.max(1.3 * CELL, 3.5 * CELL / L) + size * 0.45;
          const ccy = y - size * 0.35;
          let inside = true;
          for (const [ox, oy] of RING) {
            if (reader.biome(Math.floor((x + ox * clear) / CELL), Math.floor((ccy + oy * clear) / CELL)) !== CITY) { inside = false; break; }
          }
          if (!inside) continue;
        }
        let kind = sc.draw;
        if (kind === 'mountain') {
          const rr = Math.max(2.5, step * 1.3), ax = x / CELL, ay = y / CELL;
          let n = 0, snowy = false;
          for (const [ox, oy] of RING) {
            const v = reader.raw(Math.floor(ax + ox * rr), Math.floor(ay + oy * rr));
            if (v === MOUNT) n++;
            else if (v === SNOWB) { n += 0.75; snowy = true; }
          }
          const depth = n / RING.length;
          size *= RANGE_SIZE[Math.min(RANGE_SIZE.length - 1, Math.floor(depth * RANGE_SIZE.length))];
          // the tallest peaks along the spine carry snow too
          if (snowy || (depth > 0.95 && bucket === SIZE_BUCKETS - 1 && h < sc.p * 0.2)) kind = 'mountainSnow';
        }
        let ok = true;
        for (const [fx, fy] of FOOT) {
          if (isWater(reader.raw(Math.floor((x + fx * size) / CELL), Math.floor((y + fy * size) / CELL)))) { ok = false; break; }
        }
        if (!ok) continue;
        const variant = Math.min(VARIANTS - 1, Math.floor((h / sc.p) * VARIANTS));
        list.push({ x, y, s: size, kind, variant });
      }
    }
  }
  if (!list.length) return;
  list.sort((p, q) => p.y - q.y);

  const px = L / CELL;
  const ox = cx * CHUNK_SIZE, oy = cy * CHUNK_SIZE;
  const W = CHUNK * L;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of list) {
    const sp = sprite(p.kind, p.variant, p.s, L);
    const dx = Math.round((p.x - ox) * px - sp.ax), dy = Math.round((p.y - oy) * px - sp.ay);
    if (dx > W || dy > W || dx + sp.canvas.width < 0 || dy + sp.canvas.height < 0) continue;
    ctx.drawImage(sp.canvas, dx, dy);
  }
}

export function buildChunk(terrain, cx, cy, L, symbols) {
  if (spriteCache.size > 2000) spriteCache.clear();
  const reader = makeReader(terrain, cx, cy);
  const r = rasterChunk(reader, cx, cy, L);
  if (!r) return null;
  if (symbols) drawSymbols(r.ctx, reader, cx, cy, L);
  return r.canvas;
}
