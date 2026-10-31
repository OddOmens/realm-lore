// Builds terrain chunk bitmaps off the main thread. The renderer keeps this
// worker's copy of the terrain in step ('sync' messages carry changed chunks,
// in order, before any job that needs them) and asks for chunks with 'build';
// each answer is an ImageBitmap transferred back, or null for open sea.

import { CHUNK, BIOMES } from './terrain';
import { buildChunk } from './terrainCore';

const chunks = new Map();
const terrain = {
  chunks,
  cell(gx, gy) {
    const cx = Math.floor(gx / CHUNK), cy = Math.floor(gy / CHUNK);
    const c = chunks.get(`${cx},${cy}`);
    return c ? c[(gy - cy * CHUNK) * CHUNK + (gx - cx * CHUNK)] : 0;
  },
};

// Builds a throwaway chunk with every biome at each detail level, so the
// code is compiled and the symbol sprites drawn before real work arrives.
function warmUp() {
  const arr = new Uint8Array(CHUNK * CHUNK);
  for (let y = 0; y < CHUNK; y++) {
    for (let x = 0; x < CHUNK; x++) {
      const inside = x > 4 && y > 4 && x < CHUNK - 5 && y < CHUNK - 5;
      arr[y * CHUNK + x] = inside ? BIOMES[1 + (Math.floor(x / 6) % (BIOMES.length - 1))].id : 0;
    }
  }
  const scratch = new Map([['0,0', arr]]);
  const t = { chunks: scratch, cell: (gx, gy) => (gx >= 0 && gy >= 0 && gx < CHUNK && gy < CHUNK ? arr[gy * CHUNK + gx] : 0) };
  for (const L of [1, 2, 4, 8]) {
    try { buildChunk(t, 0, 0, L, true); } catch { /* warming is best effort */ }
  }
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'warm') {
    warmUp();
  } else if (m.type === 'sync') {
    for (const [k, arr] of m.updates) {
      if (arr) chunks.set(k, arr);
      else chunks.delete(k);
    }
  } else if (m.type === 'build') {
    let bitmap;
    try {
      const canvas = buildChunk(terrain, m.cx, m.cy, m.L, m.symbols);
      bitmap = canvas ? canvas.transferToImageBitmap() : null;
    } catch (err) {
      self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
      return;
    }
    self.postMessage({ type: 'done', id: m.id, bitmap }, bitmap ? [bitmap] : []);
  }
};
