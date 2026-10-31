// Cached tiles of everything drawn over the terrain (rivers, roads, places,
// labels, stamps), for View mode. Each tile is drawn once at the current zoom;
// panning then only copies bitmaps. While the zoom is changing, the tiles of
// the last settled zoom are drawn scaled, and the exact ones are built once
// the zoom rests (the way online maps behave).

import { visibleRect } from './view';

const TILE = 384;           // CSS px per tile side
const BUDGET_MS = 6;        // tile building per frame
const SETTLE_MS = 140;      // zoom must rest this long before rebuilding
const MAX_TILES = 260;

export function createFeatureTiles(drawFeatures) {
  let layer = null;   // { zoom, dpr, tiles: Map<key, canvas> } — the layer being built/drawn
  let prev = null;    // the previous zoom's layer, shown scaled until `layer` covers the view
  let zoomChangedAt = 0;
  let lastZoom = 0;

  const newLayer = (zoom, dpr) => ({ zoom, dpr, tiles: new Map() });

  function buildTile(L, tx, ty) {
    const ws = TILE / L.zoom; // world units per tile
    const px = Math.round(TILE * L.dpr);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    const view = { x: tx * ws, y: ty * ws, zoom: L.zoom, dpr: L.dpr, width: TILE, height: TILE };
    const s = L.zoom * L.dpr;
    ctx.setTransform(s, 0, 0, s, -view.x * s, -view.y * s);
    drawFeatures(ctx, view);
    return canvas;
  }

  function drawLayer(ctx, view, L) {
    const ws = TILE / L.zoom;
    const r = visibleRect(view);
    for (let ty = Math.floor(r.minY / ws); ty * ws < r.maxY; ty++) {
      for (let tx = Math.floor(r.minX / ws); tx * ws < r.maxX; tx++) {
        const c = L.tiles.get(`${tx},${ty}`);
        if (c) ctx.drawImage(c, tx * ws, ty * ws, ws, ws);
      }
    }
  }

  return {
    /** Drops every tile (the document changed). */
    invalidate() { layer = null; prev = null; },

    /**
     * Draws the cached features; ctx is in world transform. Returns false
     * while tiles are still being built, so the caller asks for another frame.
     */
    draw(ctx, view) {
      const now = performance.now();
      if (view.zoom !== lastZoom) { lastZoom = view.zoom; zoomChangedAt = now; }
      const settled = now - zoomChangedAt >= SETTLE_MS;

      if (!layer || layer.dpr !== view.dpr) layer = newLayer(view.zoom, view.dpr);
      else if (layer.zoom !== view.zoom && settled) {
        // Keep the old zoom's tiles as a scaled stand-in while the new ones build.
        if (layer.tiles.size) prev = layer;
        layer = newLayer(view.zoom, view.dpr);
      }

      if (layer.zoom !== view.zoom) {
        // The zoom is still moving: show the current tiles scaled and come back once it rests.
        drawLayer(ctx, view, layer);
        return false;
      }

      // Build what's missing, centre first, within the frame budget.
      let done = true;
      const ws = TILE / layer.zoom;
      const r = visibleRect(view);
      const cx = (r.minX + r.maxX) / 2, cy = (r.minY + r.maxY) / 2;
      const want = [];
      for (let ty = Math.floor(r.minY / ws); ty * ws < r.maxY; ty++) {
        for (let tx = Math.floor(r.minX / ws); tx * ws < r.maxX; tx++) {
          if (!layer.tiles.has(`${tx},${ty}`)) want.push([tx, ty, ((tx + 0.5) * ws - cx) ** 2 + ((ty + 0.5) * ws - cy) ** 2]);
        }
      }
      want.sort((a, b) => a[2] - b[2]);
      const t0 = performance.now();
      for (const [tx, ty] of want) {
        if (performance.now() - t0 > BUDGET_MS) { done = false; break; }
        layer.tiles.set(`${tx},${ty}`, buildTile(layer, tx, ty));
      }
      if (layer.tiles.size > MAX_TILES) {
        // Forget the oldest tiles (a Map keeps insertion order).
        for (const k of [...layer.tiles.keys()].slice(0, layer.tiles.size - MAX_TILES)) layer.tiles.delete(k);
      }

      // Where the new tiles still have gaps, the previous zoom's tiles fill in, scaled.
      const full = coversView(view, layer);
      if (!full && prev) drawLayer(ctx, view, prev);
      if (full) prev = null;
      drawLayer(ctx, view, layer);
      return done && full;
    },
  };

  function coversView(view, L) {
    const ws = TILE / L.zoom;
    const r = visibleRect(view);
    for (let ty = Math.floor(r.minY / ws); ty * ws < r.maxY; ty++) {
      for (let tx = Math.floor(r.minX / ws); tx * ws < r.maxX; tx++) {
        if (!L.tiles.has(`${tx},${ty}`)) return false;
      }
    }
    return true;
  }
}
