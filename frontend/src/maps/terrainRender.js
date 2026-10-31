// Draws the terrain as a fantasy atlas: a muted sea with a pale shallow band
// and ink echo lines off the coast, an inked coastline, parchment land tinted
// per biome with soft borders, and hand-drawn ink symbols (trees, mountains,
// dunes…) scattered deterministically over each biome.
//
// Each chunk is rasterised once into a cached bitmap at a detail level picked
// from the zoom (1–16 px per cell). A chunk's bitmap reads a margin of cells
// from its neighbours, so edges, the shallow band and symbols line up across
// chunk borders with no seams. Chunks are built in a pool of workers (see
// terrainWorker.js), or on the main thread within a small per-frame budget
// where workers can't draw; lower-detail bitmaps stand in until they're ready.

import { CELL, CHUNK_SIZE, hash2, chunkKey, parseKey } from './terrain';
import { PAPER, hex, smoothstep, buildChunk } from './terrainCore';

export { PAPER };

const LEVELS = [1, 2, 4, 8, 16];
const BUDGET_MS = 8;
const INTERACTIVE_MS = 350;  // an edit within this long counts as painting in progress
const MAX_CACHE_PX = 24e6;   // ~96 MB of bitmaps
const PREVIEW_LEVEL = 2;     // detail of the instant raster-only bitmap shown while painting
const PREVIEW_MS = 6;        // main-thread time per frame for those previews

// ── Sea background ────────────────────────────────────────────────────────────
// Open sea is see-through in chunk bitmaps, so one world-anchored texture
// (a soft wash, and hand-drawn wave marks at middle zooms) shows through
// everywhere without seams.

// Value noise that repeats every `period` lattice cells, for seamless tiles.
function tileNoise(x, y, period, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const w = (v) => ((v % period) + period) % period;
  const a = hash2(w(x0), w(y0), seed), b = hash2(w(x0 + 1), w(y0), seed);
  const c = hash2(w(x0), w(y0 + 1), seed), d = hash2(w(x0 + 1), w(y0 + 1), seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

function washTile(size, seed) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const deep = hex(PAPER.seaDeep), light = hex(PAPER.seaLight);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, norm = 0;
      for (let o = 0, period = 6; o < 4; o++, period *= 2) {
        v += tileNoise(x * period / size, y * period / size, period, seed + o) * amp;
        norm += amp; amp *= 0.5;
      }
      v = (v / norm - 0.5) * 2.2; // about -1 … 1
      const k = (y * size + x) * 4;
      const col = v > 0 ? deep : light;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2];
      img.data[k + 3] = Math.min(255, Math.abs(v) * (v > 0 ? 70 : 55));
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Small hand-drawn wave marks scattered over a tile (1 px per world unit).
function waveTile(size, count, seed) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = PAPER.wave;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let n = 0; n < count; n++) {
    const x = hash2(n, 1, seed) * size, y = hash2(n, 2, seed) * size;
    const arcs = 2 + Math.floor(hash2(n, 3, seed) * 2);
    const aw = 7 + hash2(n, 4, seed) * 4;
    ctx.lineWidth = 1.1 + hash2(n, 5, seed) * 0.5;
    ctx.globalAlpha = 0.5 + hash2(n, 6, seed) * 0.3;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const bx = x + ox, by = y + oy;
        if (bx < -60 || by < -20 || bx > size + 20 || by > size + 20) continue;
        ctx.beginPath();
        for (let k = 0; k < arcs; k++) {
          const sx = bx + k * aw;
          ctx.moveTo(sx, by);
          ctx.quadraticCurveTo(sx + aw / 2, by - aw * 0.55, sx + aw, by);
        }
        ctx.stroke();
      }
    }
  }
  return cv;
}

let seaTiles = null;
const seaPatterns = new WeakMap();
function patternsFor(ctx) {
  let p = seaPatterns.get(ctx);
  if (p) return p;
  if (!seaTiles) {
    seaTiles = { wash1: washTile(256, 1301), wash2: washTile(192, 1409), waves1: waveTile(1024, 16, 1511), waves2: waveTile(1376, 22, 1613) };
  }
  const make = (tile, scale, dx = 0, dy = 0) => {
    const pat = ctx.createPattern(tile, 'repeat');
    pat.setTransform(new DOMMatrix([scale, 0, 0, scale, dx, dy]));
    return pat;
  };
  p = {
    wash1: make(seaTiles.wash1, 11),
    wash2: make(seaTiles.wash2, 7.3, 900, 400),
    waves1: make(seaTiles.waves1, 1),
    waves2: make(seaTiles.waves2, 1, 517, 211),
  };
  seaPatterns.set(ctx, p);
  return p;
}

// Fills a world rect (ctx in world space) with the sea; zoom = CSS px per world unit.
function paintSea(ctx, minX, minY, maxX, maxY, zoom) {
  const w = maxX - minX, h = maxY - minY;
  ctx.fillStyle = PAPER.sea;
  ctx.fillRect(minX, minY, w, h);
  const p = patternsFor(ctx);
  // the wash is quieter zoomed far out, where the atlas should read clean
  const prev0 = ctx.globalAlpha;
  ctx.globalAlpha = prev0 * (0.45 + 0.55 * smoothstep(0.04, 0.3, zoom));
  ctx.fillStyle = p.wash1;
  ctx.fillRect(minX, minY, w, h);
  ctx.fillStyle = p.wash2;
  ctx.fillRect(minX, minY, w, h);
  ctx.globalAlpha = prev0;
  const wa = smoothstep(0.14, 0.32, zoom) * (1 - smoothstep(2.5, 5, zoom));
  if (wa > 0.01) {
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * wa;
    ctx.fillStyle = p.waves1;
    ctx.fillRect(minX, minY, w, h);
    ctx.fillStyle = p.waves2;
    ctx.fillRect(minX, minY, w, h);
    ctx.globalAlpha = prev;
  }
}

// Draws a chunk bitmap snapped to whole device pixels. Neighbours then share
// exact edges: no hairline gaps, and no double-blended overlap where the
// see-through water meets.
function drawChunk(ctx, m, canvas, cx, cy) {
  const x0 = Math.round(cx * CHUNK_SIZE * m.a + m.e), x1 = Math.round((cx + 1) * CHUNK_SIZE * m.a + m.e);
  const y0 = Math.round(cy * CHUNK_SIZE * m.d + m.f), y1 = Math.round((cy + 1) * CHUNK_SIZE * m.d + m.f);
  ctx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0);
}

// ── Renderer ──────────────────────────────────────────────────────────────────

function levelFor(pxPerCell) {
  for (const l of LEVELS) if (l >= pxPerCell * 0.9) return l;
  return LEVELS[LEVELS.length - 1];
}

// ── Worker pool ───────────────────────────────────────────────────────────────
// Chunks are built in workers when the browser can draw on an OffscreenCanvas
// there; otherwise (or if a worker fails) they're built on the main thread
// within a small time budget per frame.

function workersSupported() {
  try {
    return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' &&
      typeof OffscreenCanvas.prototype.transferToImageBitmap === 'function' &&
      !!new OffscreenCanvas(1, 1).getContext('2d');
  } catch {
    return false;
  }
}

function createPool(onResult, onFail) {
  // Two workers (three on big machines): more mostly contend for the same
  // canvas machinery and each keeps its own sprite cache.
  const size = (navigator.hardwareConcurrency || 4) >= 8 ? 3 : 2;
  const workers = [];
  try {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
      // The first worker is kept free for edits (see dispatch) so a brush
      // stroke never waits behind a queue of other chunks.
      const slot = { w, busy: 0, edits: i === 0 && size > 1 };
      w.onmessage = (e) => { slot.busy--; onResult(e.data); };
      w.onerror = (e) => { e.preventDefault?.(); onFail(); };
      workers.push(slot);
      w.postMessage({ type: 'warm' });
    }
  } catch {
    for (const s of workers) s.w.terminate();
    return null;
  }
  return {
    workers,
    post(msg, transfer) { for (const s of workers) s.w.postMessage(msg, transfer); },
    terminate() { for (const s of workers) s.w.terminate(); },
  };
}

const closeBitmap = (c) => { if (c && typeof c.close === 'function') c.close(); };

// `onUpdate` (optional) is called when a worker finishes a chunk, so the
// editor can redraw then instead of polling every frame.
export function createTerrainRenderer(terrain, { onUpdate } = {}) {
  // cacheKey `${chunk}|${level}|${symbols}` → { canvas|null, sig, own, used, px }
  const cache = new Map();
  let cachedPx = 0;
  let tick = 0;
  let lastEdit = -Infinity;

  // ── Workers ──
  let pool = null;
  let poolTried = false;
  const synced = new Map(); // chunk key → version the workers have
  let syncedRev = -1;
  let nextJob = 1;
  const inflight = new Map();      // job id → job
  const inflightByKey = new Map(); // cacheKey → sig being built
  let queue = [];

  function failPool() {
    if (!pool) return;
    pool.terminate();
    pool = null;
    inflight.clear();
    inflightByKey.clear();
    queue = [];
    onUpdate?.();
  }

  function ensurePool() {
    if (pool || poolTried) return pool;
    poolTried = true;
    if (workersSupported()) pool = createPool(onResult, failPool);
    return pool;
  }

  // Sends the workers every chunk that changed since the last sync. Messages
  // to a worker arrive in order, so jobs posted after this see the new cells.
  function syncWorkers() {
    if (!pool || terrain.revision === syncedRev) return;
    const updates = [];
    for (const [k, arr] of terrain.chunks) {
      const v = terrain.version(k);
      if (synced.get(k) !== v) { updates.push([k, arr]); synced.set(k, v); }
    }
    for (const k of [...synced.keys()]) {
      if (!terrain.chunks.has(k)) { updates.push([k, null]); synced.delete(k); }
    }
    syncedRev = terrain.revision;
    if (updates.length) pool.post({ type: 'sync', updates });
  }

  // Start the workers now so they're warm by the time chunks are wanted.
  queueMicrotask(() => ensurePool());

  function onResult(msg) {
    const job = inflight.get(msg.id);
    if (!job) { closeBitmap(msg.bitmap); return; }
    inflight.delete(msg.id);
    if (inflightByKey.get(job.key) === job.sig) inflightByKey.delete(job.key);
    if (msg.type === 'error') { failPool(); return; }
    // A newer bitmap may already be here (versions only grow); keep the newest.
    const old = cache.get(job.key);
    if (old && old.sig > job.sig) closeBitmap(msg.bitmap);
    else put(job.key, msg.bitmap, job.sig, job.own);
    dispatch();
    onUpdate?.();
  }

  // A worker for this job, or null. Edits (prio 0) go first to the edit
  // worker, else to any idle one. Other jobs use the remaining workers; cheap
  // low-detail ones are pipelined a few deep so workers never wait on the
  // main thread, but only while nothing is being painted, so an edit never
  // queues behind several. Prefetch (prio 3) only takes idle workers.
  function pickSlot(job, editsWaiting, painting) {
    let best = null;
    for (const s of pool.workers) {
      let cap;
      if (s.edits) cap = job.prio === 0 || !editsWaiting ? 1 : 0;
      else if (job.prio === 3 || painting || job.L > 4) cap = 1;
      else cap = 3;
      if (s.busy < cap && (!best || s.busy < best.busy || (s.edits && job.prio === 0 && s.busy === best.busy))) best = s;
    }
    return best;
  }

  function dispatch() {
    if (!pool) return;
    syncWorkers();
    const painting = performance.now() - lastEdit < INTERACTIVE_MS;
    let edits = 0;
    for (const j of queue) if (j.prio === 0) edits++;
    const rest = [];
    for (const job of queue) {
      if (inflightByKey.get(job.key) === job.sig) { if (job.prio === 0) edits--; continue; }
      const slot = pickSlot(job, edits > 0, painting);
      if (!slot) { rest.push(job); continue; }
      if (job.prio === 0) edits--;
      job.id = nextJob++;
      inflight.set(job.id, job);
      inflightByKey.set(job.key, job.sig);
      slot.busy++;
      slot.w.postMessage({ type: 'build', id: job.id, cx: job.cx, cy: job.cy, L: job.L, symbols: job.symbols });
    }
    queue = rest;
  }

  // True when some cached level of this chunk was built from an older version
  // of the chunk itself (i.e. it was edited, not just never built at this level).
  const ownChanged = (cx, cy, own) => {
    for (const l of LEVELS) {
      for (const sym of [0, 1]) {
        const e = cache.get(`${cx},${cy}|${l}|${sym}`);
        if (e && e.own !== own) return true;
      }
    }
    return false;
  };

  // Versions only ever grow, so their sum over the 3×3 block changes on any edit.
  const signature = (cx, cy) => {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) s += terrain.version(chunkKey(cx + dx, cy + dy));
    }
    return s;
  };

  const hasLandNear = (cx, cy) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (terrain.chunks.has(chunkKey(cx + dx, cy + dy))) return true;
    }
    return false;
  };

  function evict() {
    if (cachedPx <= MAX_CACHE_PX) return;
    const entries = [...cache.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of entries) {
      if (cachedPx <= MAX_CACHE_PX * 0.8) break;
      if (e.used === tick) continue;
      cache.delete(k);
      cachedPx -= e.px;
      closeBitmap(e.canvas);
    }
  }

  function put(k, canvas, sig, own) {
    const old = cache.get(k);
    if (old) { cachedPx -= old.px; if (old.canvas !== canvas) closeBitmap(old.canvas); }
    const px = canvas ? canvas.width * canvas.height : 0;
    cache.set(k, { canvas, sig, own, used: tick, px });
    cachedPx += px;
  }

  function build(cx, cy, L, symbols, sig) {
    const canvas = buildChunk(terrain, cx, cy, L, symbols);
    put(`${cx},${cy}|${L}|${symbols ? 1 : 0}`, canvas, sig, terrain.version(chunkKey(cx, cy)));
    return canvas;
  }

  // Best stand-in while a chunk's wanted level is being built: any cached
  // bitmap of this chunk, current ones first, then the most detailed.
  function placeholder(cx, cy, sig) {
    let best = null, bestScore = -1;
    for (const l of LEVELS) {
      for (const sym of [1, 0]) {
        const e = cache.get(`${cx},${cy}|${l}|${sym}`);
        if (!e) continue;
        const score = (e.sig === sig ? 100 : 0) + l + sym * 0.5;
        if (score > bestScore) { best = e; bestScore = score; }
      }
    }
    if (best) best.used = tick;
    return best;
  }

  function chunksInView(minX, minY, maxX, maxY) {
    // upper bounds are exclusive: a rect ending exactly on a chunk edge doesn't touch the next chunk
    const cx0 = Math.floor(minX / CHUNK_SIZE), cx1 = Math.ceil(maxX / CHUNK_SIZE) - 1;
    const cy0 = Math.floor(minY / CHUNK_SIZE), cy1 = Math.ceil(maxY / CHUNK_SIZE) - 1;
    const span = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
    const out = [];
    if (span > terrain.chunks.size * 9) {
      // zoomed far out: walk painted chunks (and their neighbours) instead of the grid
      const seen = new Set();
      for (const k of terrain.chunks.keys()) {
        const [x, y] = parseKey(k);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < cx0 || nx > cx1 || ny < cy0 || ny > cy1) continue;
            const nk = chunkKey(nx, ny);
            if (seen.has(nk)) continue;
            seen.add(nk);
            out.push([nx, ny]);
          }
        }
      }
    } else {
      for (let y = cy0; y <= cy1; y++) {
        for (let x = cx0; x <= cx1; x++) if (hasLandNear(x, y)) out.push([x, y]);
      }
    }
    return out;
  }

  // Queues worker jobs for the chunks in `pending` (already sorted by
  // priority) plus a ring of neighbours just outside the view, and returns
  // whether everything visible is already final.
  function schedule(pending, L, sym, interactive, ring, start) {
    const symKey = sym ? 1 : 0;
    const jobs = [];
    let previews = 0;
    for (const it of pending) {
      // While an edit is in progress, edited chunks come back at no more than
      // 8 px per cell so painting keeps up; full detail follows once it pauses.
      const lvl = interactive && it.prio === 0 && L > 8 ? 8 : L;
      const key = `${it.cx},${it.cy}|${lvl}|${symKey}`;
      const ready = cache.get(key);
      if (lvl !== L && ready && ready.sig === it.sig) { ready.used = tick; it.canvas = ready.canvas; continue; }
      const ph = placeholder(it.cx, it.cy, it.sig);
      it.canvas = ph?.canvas || null;
      // A chunk being painted with nothing current to show gets a quick
      // raster-only bitmap (no symbols, low detail) built right here, so the
      // paint appears on the next frame; the worker's full version follows.
      if (it.prio === 0 && (!ph || ph.sig !== it.sig) && (previews === 0 || performance.now() - start < PREVIEW_MS)) {
        const pl = Math.min(L, PREVIEW_LEVEL);
        it.canvas = build(it.cx, it.cy, pl, false, it.sig);
        previews++;
      }
      // Neighbour-only changes refine once painting pauses.
      if (interactive && it.prio === 2) continue;
      jobs.push({ key, prio: it.prio, cx: it.cx, cy: it.cy, L: lvl, symbols: sym, sig: it.sig, own: terrain.version(chunkKey(it.cx, it.cy)) });
    }
    // Prefetch: one ring of chunks beyond the view at this level.
    for (const [cx, cy] of ring) {
      const key = `${cx},${cy}|${L}|${symKey}`;
      const sig = signature(cx, cy);
      const e = cache.get(key);
      if (e && e.sig === sig) { e.used = tick; continue; }
      jobs.push({ key, prio: 3, cx, cy, L, symbols: sym, sig, own: terrain.version(chunkKey(cx, cy)) });
    }
    // Rebuild the queue from what's wanted now: chunks that scrolled away drop out.
    queue = jobs.filter(j => inflightByKey.get(j.key) !== j.sig);
    dispatch();
    return pending.length === 0;
  }

  return {
    draw(ctx, view, { symbols = true } = {}) {
      tick++;
      const start = performance.now();
      const minX = view.x, minY = view.y;
      const maxX = view.x + view.width / view.zoom, maxY = view.y + view.height / view.zoom;

      paintSea(ctx, minX, minY, maxX, maxY, view.zoom);

      const L = levelFor(view.zoom * CELL * (view.dpr || 1));
      const sym = symbols;
      // Bitmaps are drawn near 1:1 (the level matches the zoom), so the default
      // smoothing quality looks the same and is much cheaper than 'high'.
      const prevSmooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';

      // Nearest chunks to the centre build first.
      const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
      const list = chunksInView(minX, minY, maxX, maxY);
      const dist = (p) => { const dx = (p[0] + 0.5) * CHUNK_SIZE - mx, dy = (p[1] + 0.5) * CHUNK_SIZE - my; return dx * dx + dy * dy; };
      list.sort((p, q) => dist(p) - dist(q));

      // Valid bitmaps draw straight away. The rest are rebuilt: chunks that
      // were just edited first, then missing ones nearest the middle of the
      // view, then chunks whose neighbour changed (an edit next door only
      // touches a bitmap's margin, so the old one stands in meanwhile).
      const symKey = sym ? 1 : 0;
      const now = performance.now();
      const items = [];
      const pending = [];
      for (const [cx, cy] of list) {
        const sig = signature(cx, cy);
        const ent = cache.get(`${cx},${cy}|${L}|${symKey}`);
        const it = { cx, cy, sig, canvas: null };
        items.push(it);
        if (ent && ent.sig === sig) { ent.used = tick; it.canvas = ent.canvas; continue; }
        const own = terrain.version(chunkKey(cx, cy));
        if (!ent) it.prio = ownChanged(cx, cy, own) ? 0 : 1;
        else it.prio = ent.own === own ? 2 : 0;
        if (it.prio === 0) lastEdit = now;
        pending.push(it);
      }
      pending.sort((p, q) => p.prio - q.prio);
      const interactive = now - lastEdit < INTERACTIVE_MS;

      let complete = true;
      if (ensurePool()) {
        let ring = [];
        if (!pending.length) {
          // Only prefetch when the view itself is done.
          const pad = CHUNK_SIZE;
          const seen = new Set(list.map(([x, y]) => chunkKey(x, y)));
          ring = chunksInView(minX - pad, minY - pad, maxX + pad, maxY + pad)
            .filter(([x, y]) => !seen.has(chunkKey(x, y)));
        }
        complete = schedule(pending, L, sym, interactive, ring, start);
        // Results arrive through onUpdate when the editor wired it; otherwise
        // keep asking for frames until the view is final.
        if (!complete && onUpdate) complete = true;
      } else {
        let built = 0;
        for (const it of pending) {
          const inBudget = built === 0 || performance.now() - start < BUDGET_MS;
          if (interactive && it.prio === 0 && L > 8) {
            // quick interim bitmap at level 8 while the edit goes on
            if (inBudget) { it.canvas = build(it.cx, it.cy, 8, sym, it.sig); built++; }
            else it.canvas = placeholder(it.cx, it.cy, it.sig)?.canvas || null;
            complete = false;
          } else if (inBudget && !(interactive && it.prio === 2)) {
            it.canvas = build(it.cx, it.cy, L, sym, it.sig);
            built++;
          } else {
            complete = false;
            const ph = placeholder(it.cx, it.cy, it.sig);
            it.canvas = ph ? ph.canvas : null;
          }
        }
      }
      const m = ctx.getTransform();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const it of items) {
        if (it.canvas) drawChunk(ctx, m, it.canvas, it.cx, it.cy);
      }
      ctx.setTransform(m);
      ctx.imageSmoothingEnabled = prevSmooth;
      evict();
      return complete;
    },

    invalidate(keys) {
      // Signatures already catch edits; this frees the outdated bitmaps of
      // chunks that are no longer visible, and marks painting as in progress.
      lastEdit = performance.now();
      const touched = new Set();
      for (const k of keys) {
        const [x, y] = parseKey(k);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) touched.add(chunkKey(x + dx, y + dy));
      }
      for (const [ck, e] of cache) {
        const chunk = ck.slice(0, ck.indexOf('|'));
        if (touched.has(chunk) && e.used !== tick) { cache.delete(ck); cachedPx -= e.px; closeBitmap(e.canvas); }
      }
    },

    clear() {
      for (const e of cache.values()) closeBitmap(e.canvas);
      cache.clear();
      cachedPx = 0;
    },

    renderRegion(rect, scale, { symbols = true } = {}) {
      const w = Math.max(1, Math.ceil((rect.maxX - rect.minX) * scale));
      const h = Math.max(1, Math.ceil((rect.maxY - rect.minY) * scale));
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const ctx = out.getContext('2d');
      ctx.setTransform(scale, 0, 0, scale, -rect.minX * scale, -rect.minY * scale);
      paintSea(ctx, rect.minX, rect.minY, rect.maxX, rect.maxY, scale);
      const L = levelFor(scale * CELL);
      const sym = symbols;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const m = ctx.getTransform();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const [cx, cy] of chunksInView(rect.minX, rect.minY, rect.maxX, rect.maxY)) {
        const sig = signature(cx, cy);
        // Exports at full detail can be large; don't keep those bitmaps around.
        const k = `${cx},${cy}|${L}|${sym ? 1 : 0}`;
        const cached = cache.get(k);
        const canvas = cached && cached.sig === sig ? cached.canvas : buildChunk(terrain, cx, cy, L, sym);
        if (canvas) drawChunk(ctx, m, canvas, cx, cy);
      }
      return out;
    },

    // Stops the workers (the editor calls this when the map closes).
    dispose() {
      this.clear();
      if (pool) { pool.terminate(); pool = null; }
    },
  };
}
