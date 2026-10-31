// Endless terrain for the map builder.
//
// The world is a grid of CELL-sized cells, each holding one biome id. Cells are
// stored in CHUNK×CHUNK blocks created on demand, so a map can grow in any
// direction without limit; a missing chunk is all ocean. World units: x right,
// y down; one world unit is one CSS pixel at zoom 1.

export const CELL = 8;
export const CHUNK = 64;
export const CHUNK_SIZE = CELL * CHUNK; // 512 world units per chunk side
const N = CHUNK * CHUNK;

// Biome ids are what get saved, so never renumber them; add new ones at the end.
export const BIOMES = [
  { id: 0,  key: 'ocean',     label: 'Ocean',     water: true },
  { id: 1,  key: 'grass',     label: 'Grassland' },
  { id: 2,  key: 'forest',    label: 'Forest' },
  { id: 3,  key: 'jungle',    label: 'Jungle' },
  { id: 4,  key: 'desert',    label: 'Desert' },
  { id: 5,  key: 'hills',     label: 'Hills' },
  { id: 6,  key: 'mountains', label: 'Mountains' },
  { id: 7,  key: 'snow',      label: 'Snow' },
  { id: 8,  key: 'swamp',     label: 'Swamp' },
  { id: 9,  key: 'lake',      label: 'Lake',      water: true },
  { id: 10, key: 'badlands',  label: 'Badlands' },
  { id: 11, key: 'farmland',  label: 'Farmland' },
  { id: 12, key: 'city',      label: 'City' },
  { id: 13, key: 'town',      label: 'Town' },
];
export const BIOME = Object.fromEntries(BIOMES.map(b => [b.key.toUpperCase(), b.id]));
export const BIOME_BY_ID = BIOMES;
export const isWater = (id) => id === BIOME.OCEAN || id === BIOME.LAKE;
export const isLand = (id) => !isWater(id);

export const chunkKey = (cx, cy) => `${cx},${cy}`;
export function parseKey(k) {
  const i = k.indexOf(',');
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
}

// ── Noise ─────────────────────────────────────────────────────────────────────
// Small deterministic value noise; enough for rough brush edges, symbol
// scatter and the continent generator.

export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smooth(x - x0), ty = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}

// Fractal noise in [0, 1].
export function fbm(x, y, seed = 0, octaves = 4) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, y * f, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// ── Run-length encoding for saving chunks ─────────────────────────────────────

function encodeChunk(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i];
    let n = 1;
    while (i + n < arr.length && arr[i + n] === v && n < 255) n++;
    out.push(n, v);
    i += n;
  }
  let s = '';
  for (let j = 0; j < out.length; j += 0x8000) s += String.fromCharCode.apply(null, out.slice(j, j + 0x8000));
  return btoa(s);
}

function decodeChunk(b64) {
  const s = atob(b64);
  const arr = new Uint8Array(N);
  let p = 0;
  for (let i = 0; i + 1 < s.length && p < N; i += 2) {
    const n = s.charCodeAt(i), v = s.charCodeAt(i + 1);
    arr.fill(v, p, Math.min(N, p + n));
    p += n;
  }
  return arr;
}

// ── Terrain ───────────────────────────────────────────────────────────────────

export class Terrain {
  constructor() {
    this.chunks = new Map();   // key → Uint8Array(CHUNK*CHUNK)
    this.versions = new Map(); // key → edit counter, for render caches
    this.revision = 0;         // bumps on any change
    this._edit = null;         // { before: Map<key, Uint8Array|null> } while an edit is open
  }

  /** Biome at cell (gx, gy). */
  cell(gx, gy) {
    const cx = Math.floor(gx / CHUNK), cy = Math.floor(gy / CHUNK);
    const c = this.chunks.get(chunkKey(cx, cy));
    if (!c) return 0;
    return c[(gy - cy * CHUNK) * CHUNK + (gx - cx * CHUNK)];
  }

  /** Biome under world point (wx, wy). */
  at(wx, wy) {
    return this.cell(Math.floor(wx / CELL), Math.floor(wy / CELL));
  }

  version(key) { return this.versions.get(key) || 0; }

  _writable(cx, cy) {
    const k = chunkKey(cx, cy);
    let c = this.chunks.get(k);
    if (this._edit && !this._edit.before.has(k)) this._edit.before.set(k, c ? c.slice() : null);
    if (!c) { c = new Uint8Array(N); this.chunks.set(k, c); }
    return c;
  }

  /** Sets one cell; adds the chunk key to `dirty` when it changes. */
  setCell(gx, gy, biome, dirty) {
    const cx = Math.floor(gx / CHUNK), cy = Math.floor(gy / CHUNK);
    const k = chunkKey(cx, cy);
    const existing = this.chunks.get(k);
    const i = (gy - cy * CHUNK) * CHUNK + (gx - cx * CHUNK);
    if ((existing ? existing[i] : 0) === biome) return;
    this._writable(cx, cy)[i] = biome;
    dirty.add(k);
  }

  _commit(dirty) {
    for (const k of dirty) {
      const c = this.chunks.get(k);
      if (c && !c.some(v => v !== 0)) this.chunks.delete(k);
      this.versions.set(k, this.version(k) + 1);
    }
    if (dirty.size) this.revision++;
    return dirty;
  }

  // Undo support: open an edit, change cells, then endEdit() returns
  // { before, after } (Map key → Uint8Array|null), or null if nothing changed.
  beginEdit() { this._edit = { before: new Map() }; }

  endEdit() {
    const edit = this._edit;
    this._edit = null;
    if (!edit || edit.before.size === 0) return null;
    const after = new Map();
    let changed = false;
    for (const [k, before] of edit.before) {
      const now = this.chunks.get(k) || null;
      after.set(k, now ? now.slice() : null);
      if (!changed) {
        // A missing chunk is all ocean (zeros).
        for (let i = 0; i < N && !changed; i++) changed = (before ? before[i] : 0) !== (now ? now[i] : 0);
      }
    }
    return changed ? { before: edit.before, after } : null;
  }

  /** Puts chunks back as they were in a snapshot; returns the dirty keys. */
  applySnapshot(snap) {
    const dirty = new Set();
    for (const [k, arr] of snap) {
      if (arr && arr.some(v => v)) this.chunks.set(k, arr.slice());
      else this.chunks.delete(k);
      dirty.add(k);
    }
    return this._commit(dirty);
  }

  /**
   * Paints a disc of `biome` centred on world (wx, wy) with world radius r.
   * opts.rough (0..1) wobbles the edge with noise for natural coastlines.
   * opts.mask: 'land' only repaints land cells, 'water' only water cells.
   */
  paintCircle(wx, wy, r, biome, opts = {}, dirty = new Set()) {
    const rough = opts.rough ?? 0;
    const reach = r * (1 + rough * 0.5);
    const gx0 = Math.floor((wx - reach) / CELL), gx1 = Math.floor((wx + reach) / CELL);
    const gy0 = Math.floor((wy - reach) / CELL), gy1 = Math.floor((wy + reach) / CELL);
    const scale = Math.max(r * 0.7, CELL * 3);
    const seed = opts.seed ?? 7;
    for (let gy = gy0; gy <= gy1; gy++) {
      const py = (gy + 0.5) * CELL;
      for (let gx = gx0; gx <= gx1; gx++) {
        const px = (gx + 0.5) * CELL;
        const dx = px - wx, dy = py - wy;
        const d = Math.sqrt(dx * dx + dy * dy);
        let limit = r;
        if (rough > 0) limit = r * (1 + rough * (fbm(px / scale, py / scale, seed, 3) - 0.5));
        if (d > limit) continue;
        if (opts.mask) {
          const cur = this.cell(gx, gy);
          if (opts.mask === 'land' && isWater(cur)) continue;
          if (opts.mask === 'water' && !isWater(cur)) continue;
        }
        this.setCell(gx, gy, biome, dirty);
      }
    }
    return dirty;
  }

  /** Paints along a segment, as a brush drag does. Returns dirty keys. */
  stroke(x0, y0, x1, y1, r, biome, opts = {}) {
    const dirty = new Set();
    const len = Math.hypot(x1 - x0, y1 - y0);
    const step = Math.max(CELL * 0.75, r * 0.3);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.paintCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, biome, opts, dirty);
    }
    return this._commit(dirty);
  }

  /** One dab, committed. */
  paint(wx, wy, r, biome, opts = {}) {
    return this._commit(this.paintCircle(wx, wy, r, biome, opts));
  }

  /**
   * Flood-fills the connected region of the biome under (wx, wy).
   * Returns the dirty keys, or { tooBig: true } (and changes nothing) when
   * the region is larger than `max` cells — e.g. filling the open ocean.
   */
  fill(wx, wy, biome, max = 600000) {
    const sx = Math.floor(wx / CELL), sy = Math.floor(wy / CELL);
    const target = this.cell(sx, sy);
    if (target === biome) return new Set();
    const seen = new Set();
    const cells = [];
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      const k = x + ',' + y;
      if (seen.has(k) || this.cell(x, y) !== target) continue;
      seen.add(k);
      cells.push(x, y);
      if (cells.length / 2 > max) return { tooBig: true };
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    const dirty = new Set();
    for (let i = 0; i < cells.length; i += 2) this.setCell(cells[i], cells[i + 1], biome, dirty);
    return this._commit(dirty);
  }

  /** Writes many cells at once (generator). `fn(gx, gy)` returns a biome or -1 to skip. */
  fillRect(gx0, gy0, gx1, gy1, fn) {
    const dirty = new Set();
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const b = fn(gx, gy);
        if (b >= 0) this.setCell(gx, gy, b, dirty);
      }
    }
    return this._commit(dirty);
  }

  isEmpty() { return this.chunks.size === 0; }

  /** World-space bounds of all painted (non-ocean) cells, or null. */
  bounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [k, c] of this.chunks) {
      const [cx, cy] = parseKey(k);
      for (let i = 0; i < N; i++) {
        if (!c[i]) continue;
        const gx = cx * CHUNK + (i % CHUNK), gy = cy * CHUNK + Math.floor(i / CHUNK);
        if (gx < minX) minX = gx;
        if (gx > maxX) maxX = gx;
        if (gy < minY) minY = gy;
        if (gy > maxY) maxY = gy;
      }
    }
    if (minX === Infinity) return null;
    return { minX: minX * CELL, minY: minY * CELL, maxX: (maxX + 1) * CELL, maxY: (maxY + 1) * CELL };
  }

  toJSON() {
    const chunks = {};
    for (const [k, c] of this.chunks) chunks[k] = encodeChunk(c);
    return { v: 1, cell: CELL, chunk: CHUNK, chunks };
  }

  static fromJSON(data) {
    const t = new Terrain();
    if (data && data.chunks && data.cell === CELL && data.chunk === CHUNK) {
      for (const [k, b64] of Object.entries(data.chunks)) {
        try { t.chunks.set(k, decodeChunk(b64)); } catch { /* skip a corrupt chunk rather than lose the map */ }
      }
    }
    return t;
  }
}
