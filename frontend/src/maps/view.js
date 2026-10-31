// Camera for the map builder. `view` is { x, y, zoom, width, height, dpr }:
// (x, y) is the world point at the canvas's top-left corner, zoom is CSS pixels
// per world unit, width/height are the canvas size in CSS pixels.
//
// Drawing code runs with the context already in world space (see
// applyWorldTransform), so it draws in world units and divides by view.zoom
// for anything that should stay a fixed size on screen.

export const ZOOM_MIN = 0.03;
export const ZOOM_MAX = 4;

export function worldToScreen(view, wx, wy) {
  return [(wx - view.x) * view.zoom, (wy - view.y) * view.zoom];
}

export function screenToWorld(view, sx, sy) {
  return [sx / view.zoom + view.x, sy / view.zoom + view.y];
}

export function applyWorldTransform(ctx, view) {
  const s = view.zoom * view.dpr;
  ctx.setTransform(s, 0, 0, s, -view.x * s, -view.y * s);
}

export function applyScreenTransform(ctx, view) {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
}

/** Visible world rectangle, optionally grown by `pad` world units. */
export function visibleRect(view, pad = 0) {
  return {
    minX: view.x - pad,
    minY: view.y - pad,
    maxX: view.x + view.width / view.zoom + pad,
    maxY: view.y + view.height / view.zoom + pad,
  };
}

/** Zooms by `factor` keeping screen point (sx, sy) fixed. */
export function zoomAt(view, sx, sy, factor) {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * factor));
  const [wx, wy] = screenToWorld(view, sx, sy);
  return { ...view, zoom, x: wx - sx / zoom, y: wy - sy / zoom };
}

/** A view that fits world rect `r` into the canvas with a margin. */
export function fitRect(view, r, margin = 48) {
  const w = Math.max(1, r.maxX - r.minX), h = Math.max(1, r.maxY - r.minY);
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN,
    Math.min((view.width - margin * 2) / w, (view.height - margin * 2) / h)));
  return {
    ...view,
    zoom,
    x: (r.minX + r.maxX) / 2 - view.width / zoom / 2,
    y: (r.minY + r.maxY) / 2 - view.height / zoom / 2,
  };
}
