// Vector features drawn over the terrain: rivers, roads, trails, borders and
// freehand ink; places (settlements and sites) with their names; and free text
// labels. Everything is drawn in world units with the context already in world
// space (see view.js); sizes that should stay readable on screen are clamped
// in screen pixels and divided by view.zoom.

import { CELL, isWater } from './terrain';

export const INK = '#4a3b2a';
export const PAPER = '#f1e7cc';      // halo behind text, fill inside glyphs
const PAPER_SHADE = '#d8c69c';       // shaded faces of glyphs
const ROOF = '#a14f35';
const ROOF_SHADE = '#7e3b27';
const BANNER = '#a8332b';
const WATER = '#abc8c6';             // river water: the lake colour (terrainCore PAPER.lake)
const WATER_INK = '#47667a';
const SHADOW = 'rgba(58, 44, 28, 0.18)';
const BRAND = '#3b5bdb';

// ── Kinds ─────────────────────────────────────────────────────────────────────

export const PATH_KINDS = [
  { kind: 'river',  label: 'River',  defaultWidth: 8,  color: WATER },
  { kind: 'road',   label: 'Road',   defaultWidth: 5,  color: '#7a4a2a' },
  { kind: 'trail',  label: 'Trail',  defaultWidth: 4,  color: '#7a5a3a' },
  { kind: 'border', label: 'Border', defaultWidth: 6,  color: '#8c3b5e' },
  { kind: 'ink',    label: 'Ink',    defaultWidth: 3,  color: INK },
];
export const PATH_BY_KIND = Object.fromEntries(PATH_KINDS.map(k => [k.kind, k]));

// size / labelSize are world units; minPx/maxPx clamp the icon on screen;
// minZoom hides the place (icon and name) when zoomed out further.
export const PLACE_KINDS = [
  { kind: 'capital',  label: 'Capital',  size: 46, labelSize: 22, minPx: 32, maxPx: 60, minZoom: 0 },
  { kind: 'city',     label: 'City',     size: 40, labelSize: 18, minPx: 28, maxPx: 54, minZoom: 0.03 },
  { kind: 'town',     label: 'Town',     size: 34, labelSize: 15, minPx: 22, maxPx: 44, minZoom: 0.05 },
  { kind: 'village',  label: 'Village',  size: 26, labelSize: 12, minPx: 18, maxPx: 34, minZoom: 0.08 },
  { kind: 'castle',   label: 'Castle',   size: 34, labelSize: 14, minPx: 24, maxPx: 48, minZoom: 0.04 },
  { kind: 'port',     label: 'Port',     size: 32, labelSize: 14, minPx: 22, maxPx: 42, minZoom: 0.05 },
  { kind: 'ruin',     label: 'Ruin',     size: 30, labelSize: 13, minPx: 20, maxPx: 38, minZoom: 0.06 },
  { kind: 'tower',    label: 'Tower',    size: 32, labelSize: 13, minPx: 21, maxPx: 42, minZoom: 0.06 },
  { kind: 'temple',   label: 'Temple',   size: 32, labelSize: 13, minPx: 21, maxPx: 40, minZoom: 0.06 },
  { kind: 'dungeon',  label: 'Dungeon',  size: 32, labelSize: 13, minPx: 21, maxPx: 40, minZoom: 0.06 },
  { kind: 'camp',     label: 'Camp',     size: 28, labelSize: 12, minPx: 18, maxPx: 36, minZoom: 0.08 },
  { kind: 'landmark', label: 'Landmark', size: 32, labelSize: 13, minPx: 20, maxPx: 40, minZoom: 0.06 },
];
export const PLACE_BY_KIND = Object.fromEntries(PLACE_KINDS.map(k => [k.kind, k]));

export const LABEL_STYLES = [
  { style: 'realm',  label: 'Realm',  defaultSize: 140, font: '600 {s}px Cinzel, Georgia, serif', caps: true, spacing: 0.32, color: INK },
  { style: 'region', label: 'Region', defaultSize: 64,  font: '500 {s}px Cinzel, Georgia, serif', caps: true, spacing: 0.2,  color: '#5a4a36' },
  { style: 'sea',    label: 'Sea',    defaultSize: 80,  font: 'italic 500 {s}px Lora, Georgia, serif', caps: false, spacing: 0.12, color: '#3d5a73' },
  { style: 'place',  label: 'Place',  defaultSize: 24,  font: '500 {s}px Lora, Georgia, serif', caps: false, spacing: 0.02, color: INK },
];
export const LABEL_BY_STYLE = Object.fromEntries(LABEL_STYLES.map(s => [s.style, s]));

// ── Geometry helpers ──────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function pathBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Ramer–Douglas–Peucker simplification. */
export function simplifyPoints(points, tolerance) {
  if (!points || points.length < 3) return points ? points.slice() : [];
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
      const qx = ax + t * dx - px, qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2 && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

const pathCache = new WeakMap();   // points array → Path2D
const boundsCache = new WeakMap(); // points array → bounds
const denseCache = new WeakMap();  // points array → sampled centreline

/** Smooth curve through the points (quadratic midpoint smoothing). */
export function smoothPath(points) {
  let p = pathCache.get(points);
  if (p) return p;
  p = new Path2D();
  if (points.length === 1) {
    p.moveTo(points[0][0], points[0][1]);
    p.lineTo(points[0][0] + 0.01, points[0][1]);
  } else if (points.length === 2) {
    p.moveTo(points[0][0], points[0][1]);
    p.lineTo(points[1][0], points[1][1]);
  } else if (points.length > 2) {
    p.moveTo(points[0][0], points[0][1]);
    p.lineTo((points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2);
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i], [nx, ny] = points[i + 1];
      p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    const last = points[points.length - 1];
    p.lineTo(last[0], last[1]);
  }
  pathCache.set(points, p);
  return p;
}

function cachedBounds(points) {
  let b = boundsCache.get(points);
  if (!b) { b = pathBounds(points); boundsCache.set(points, b); }
  return b;
}

// Points along the same curve smoothPath draws, about `step` apart.
function densePoints(points) {
  let d = denseCache.get(points);
  if (d) return d;
  d = [];
  const push = (x, y) => d.push([x, y]);
  const quad = (x0, y0, cx, cy, x1, y1) => {
    const len = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
    const n = Math.max(2, Math.ceil(len / 6));
    for (let i = 1; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      push(mt * mt * x0 + 2 * mt * t * cx + t * t * x1, mt * mt * y0 + 2 * mt * t * cy + t * t * y1);
    }
  };
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 1; i <= n; i++) push(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n);
  };
  if (points.length) push(points[0][0], points[0][1]);
  if (points.length === 2) line(points[0][0], points[0][1], points[1][0], points[1][1]);
  else if (points.length > 2) {
    let mx = (points[0][0] + points[1][0]) / 2, my = (points[0][1] + points[1][1]) / 2;
    line(points[0][0], points[0][1], mx, my);
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i], [nx, ny] = points[i + 1];
      const ex = (x + nx) / 2, ey = (y + ny) / 2;
      quad(mx, my, x, y, ex, ey);
      mx = ex; my = ey;
    }
    const last = points[points.length - 1];
    line(mx, my, last[0], last[1]);
  }
  denseCache.set(points, d);
  return d;
}

function visible(b, view, pad) {
  const minX = view.x - pad, minY = view.y - pad;
  const maxX = view.x + view.width / view.zoom + pad, maxY = view.y + view.height / view.zoom + pad;
  return b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY;
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const PATH_ORDER = { border: 0, river: 1, road: 2, trail: 3, ink: 4 };

// A river is a filled ribbon that widens from a thin source to its mouth.
// w0/w1 are the full widths (world units) at the source and the mouth.
const ribbonCache = new WeakMap(); // points array → { key, path }
function riverRibbon(points, w0, w1) {
  const key = `${w0.toFixed(3)}|${w1.toFixed(3)}`;
  const hit = ribbonCache.get(points);
  if (hit && hit.key === key) return hit.rib;
  const d = densePoints(points);
  if (d.length < 2) return null;
  const left = [], right = [];
  // Cumulative length so width grows with distance travelled.
  const acc = [0];
  for (let i = 1; i < d.length; i++) acc.push(acc[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
  for (let i = 0; i < d.length; i++) {
    // Normal from a wider window, so the banks stay smooth through tight bends.
    const a = d[Math.max(0, i - 2)], b = d[Math.min(d.length - 1, i + 2)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const t = acc[i] / total;
    const w = (w0 + (w1 - w0) * Math.pow(t, 0.7)) / 2;
    left.push([d[i][0] + nx * w, d[i][1] + ny * w]);
    right.push([d[i][0] - nx * w, d[i][1] - ny * w]);
  }
  const p = new Path2D();
  p.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) p.lineTo(left[i][0], left[i][1]);
  // Round mouth so it melts into the sea or the river it joins.
  const e = d[d.length - 1];
  p.arc(e[0], e[1], w1 / 2, Math.atan2(left[left.length - 1][1] - e[1], left[left.length - 1][0] - e[0]),
    Math.atan2(right[right.length - 1][1] - e[1], right[right.length - 1][0] - e[0]), true);
  for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1]);
  p.closePath();
  const rib = { path: p, left, right };
  ribbonCache.set(points, { key, rib });
  return rib;
}

// How watery the terrain is at a world point, 0..1, blended between cell
// centres so it crosses 0.5 about where the drawn shore runs.
function waterAt(terrain, x, y) {
  const gx = x / CELL - 0.5, gy = y / CELL - 0.5;
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const w = (a, b) => (isWater(terrain.cell(a, b)) ? 1 : 0);
  return (w(i, j) * (1 - fx) + w(i + 1, j) * fx) * (1 - fy) + (w(i, j + 1) * (1 - fx) + w(i + 1, j + 1) * fx) * fy;
}

// The river's two banks as open lines, broken wherever they run into a lake
// or the sea so the river flows into it without an inked mouth.
const bankCache = new WeakMap(); // ribbon → { rev, path }
function riverBanks(rib, terrain) {
  const rev = terrain ? terrain.revision : -1;
  const hit = bankCache.get(rib);
  if (hit && hit.rev === rev) return hit.path;
  const p = new Path2D();
  for (const side of [rib.left, rib.right]) {
    let open = false, prev = null, pw = 0;
    for (const pt of side) {
      const w = terrain ? waterAt(terrain, pt[0], pt[1]) : 0;
      if (prev && (w < 0.5) !== (pw < 0.5)) {
        // cut the line where it crosses the shore
        const t = (0.5 - pw) / (w - pw);
        const x = prev[0] + (pt[0] - prev[0]) * t, y = prev[1] + (pt[1] - prev[1]) * t;
        if (open) p.lineTo(x, y); else p.moveTo(x, y);
        open = !open;
      }
      if (w < 0.5) {
        if (open) p.lineTo(pt[0], pt[1]); else { p.moveTo(pt[0], pt[1]); open = true; }
      }
      prev = pt; pw = w;
    }
  }
  bankCache.set(rib, { rev, path: p });
  return p;
}

// One side of a line, shifted by `off` world units (left of travel when off > 0).
const offsetCache = new WeakMap();
function offsetPath(points, off) {
  const key = off.toFixed(3);
  const hit = offsetCache.get(points);
  if (hit && hit.key === key) return hit.path;
  const d = densePoints(points);
  const p = new Path2D();
  for (let i = 0; i < d.length; i++) {
    const a = d[Math.max(0, i - 2)], b = d[Math.min(d.length - 1, i + 2)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const x = d[i][0] + nx * off, y = d[i][1] + ny * off;
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  offsetCache.set(points, { key, path: p });
  return p;
}

function drawPath(ctx, path, zoom, selected) {
  const pts = path.points;
  if (!pts || pts.length < 1) return;
  const meta = PATH_BY_KIND[path.kind] || PATH_BY_KIND.ink;
  const width = path.width || meta.defaultWidth;
  const px = 1 / zoom; // one screen pixel in world units
  const curve = smoothPath(pts);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  if (selected) {
    ctx.strokeStyle = 'rgba(59, 91, 219, 0.28)';
    ctx.lineWidth = Math.max(width + 10 * px, 10 * px);
    ctx.stroke(curve);
  }

  switch (path.kind) {
    case 'road': {
      // A pale bed under a dashed ink line: the classic atlas road.
      const w = Math.max(width * 0.42, 1.3 * px);
      ctx.strokeStyle = 'rgba(244, 236, 214, 0.75)';
      ctx.lineWidth = w + Math.max(width * 0.7, 2.5 * px);
      ctx.stroke(curve);
      ctx.strokeStyle = path.color || meta.color;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      const dash = Math.max(width * 2.2, 6 * px), gap = Math.max(width * 1.1, 3.5 * px);
      ctx.setLineDash([dash, gap + w]);
      ctx.stroke(curve);
      break;
    }
    case 'trail': {
      ctx.strokeStyle = path.color || meta.color;
      ctx.lineWidth = Math.max(width * 0.5, 1.7 * px);
      ctx.setLineDash([0.01, Math.max(width * 1.3, 4.5 * px)]);
      ctx.stroke(curve);
      break;
    }
    case 'border': {
      // Realm border: a soft colour wash on one side (left of the direction it
      // was drawn) and a dot-dash line on top.
      const color = path.color || meta.color;
      const band = Math.max(width * 3, 9 * px);
      ctx.strokeStyle = color;
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = band;
      ctx.stroke(offsetPath(pts, band / 2));
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = band * 0.45;
      ctx.stroke(offsetPath(pts, band * 0.22));
      ctx.globalAlpha = 0.9;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(width * 0.4, 1.4 * px);
      const dash = Math.max(width * 2.6, 8 * px), gap = Math.max(width * 1.2, 4 * px);
      ctx.setLineDash([dash, gap, 0.01, gap]);
      ctx.stroke(curve);
      ctx.globalAlpha = 1;
      break;
    }
    default: {
      ctx.strokeStyle = path.color || INK;
      ctx.lineWidth = Math.max(width, 1 * px);
      ctx.stroke(curve);
    }
  }
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
}

// Rivers are drawn together in three passes (a darker land rim, inked banks,
// then the water) so where rivers meet, the water covers the banks between them.
function drawRivers(ctx, rivers, zoom, selectedId, terrain) {
  const px = 1 / zoom;
  const items = [];
  for (const path of rivers) {
    const width = path.width || PATH_BY_KIND.river.defaultWidth;
    // Source starts as a hairline and the mouth reaches the river's width,
    // never thinner on screen than ~1 px / ~2.6 px so water shows between the
    // banks at any zoom.
    const rib = riverRibbon(path.points, Math.max(width * 0.22, 1 * px), Math.max(width, 2.6 * px));
    if (!rib) continue;
    items.push({ path, width, rib, banks: riverBanks(rib, terrain) });
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  for (const it of items) {
    if (it.path.id !== selectedId) continue;
    ctx.strokeStyle = 'rgba(59, 91, 219, 0.28)';
    ctx.lineWidth = Math.max(it.width + 10 * px, 10 * px);
    ctx.stroke(smoothPath(it.path.points));
  }
  ctx.strokeStyle = INK;
  for (const it of items) {
    const rim = clamp(it.width * 0.5, 2 * px, 8 * px);
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = rim * 2;
    ctx.stroke(it.banks);
    ctx.lineWidth = rim;
    ctx.stroke(it.banks);
  }
  // Half of each bank line is under the water, so it is drawn twice as wide.
  ctx.globalAlpha = 0.9;
  for (const it of items) {
    ctx.lineWidth = 2 * clamp(it.width * 0.09, 0.55 * px, 1.6 * px);
    ctx.stroke(it.banks);
  }
  ctx.globalAlpha = 1;
  for (const it of items) {
    ctx.fillStyle = it.path.color || WATER;
    ctx.fill(it.rib.path);
  }
}

/**
 * Draws paths in atlas order: borders, rivers, roads, trails, ink. With a
 * terrain, river banks stop where the river runs into a lake or the sea.
 */
export function drawPaths(ctx, paths, view, { selectedId, kinds, terrain } = {}) {
  if (!paths?.length) return;
  const allow = kinds ? new Set(kinds) : null;
  const list = paths
    .filter(p => p.points?.length && (!allow || allow.has(p.kind)))
    .filter(p => visible(cachedBounds(p.points), view, (p.width || 8) * 4))
    .sort((a, b) => (PATH_ORDER[a.kind] ?? 9) - (PATH_ORDER[b.kind] ?? 9));
  ctx.save();
  let riversDone = false;
  for (const p of list) {
    if (p.kind === 'river') {
      if (!riversDone) drawRivers(ctx, list.filter(r => r.kind === 'river'), view.zoom, selectedId, terrain);
      riversDone = true;
      continue;
    }
    drawPath(ctx, p, view.zoom, p.id === selectedId);
  }
  ctx.restore();
}

// ── Text ──────────────────────────────────────────────────────────────────────

let measureCtx = null;
function measurer() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

// Width of `text` drawn char by char with extra spacing (em fraction).
function spacedWidth(ctx, text, size, spacing) {
  if (!spacing) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing * size;
  return w - spacing * size;
}

function drawSpaced(ctx, text, x, y, size, spacing, mode) {
  if (!spacing) {
    if (mode === 'stroke') ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    if (mode === 'stroke') ctx.strokeText(ch, cx, y);
    else ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing * size;
  }
  ctx.textAlign = align;
}

// Text with a parchment halo so it reads over any terrain: a wide, faint
// knock-out and a tighter solid one, so the edge feels like paper rather than
// a hard outline. `halo: 0` draws plain text (sea names sit on water).
function haloText(ctx, text, x, y, size, { spacing = 0, color = INK, align = 'left', halo = 0.28 } = {}) {
  const width = spacedWidth(ctx, text, size, spacing);
  const sx = align === 'center' ? x - width / 2 : x;
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  if (halo > 0) {
    ctx.strokeStyle = 'rgba(243, 234, 208, 0.45)';
    ctx.lineWidth = size * halo * 1.8;
    drawSpaced(ctx, text, sx, y, size, spacing, 'stroke');
    ctx.strokeStyle = 'rgba(243, 234, 208, 0.9)';
    ctx.lineWidth = size * halo;
    drawSpaced(ctx, text, sx, y, size, spacing, 'stroke');
  }
  ctx.fillStyle = color;
  drawSpaced(ctx, text, sx, y, size, spacing, 'fill');
  return width;
}

// ── Places ────────────────────────────────────────────────────────────────────

// On-screen icon size for a place: world size clamped to its pixel range.
function placeSize(meta, zoom) {
  return clamp(meta.size * zoom, meta.minPx, meta.maxPx) / zoom;
}
function placeLabelSize(meta, zoom) {
  return clamp(meta.labelSize * zoom, Math.max(12, meta.minPx * 0.52), Math.max(meta.maxPx * 0.5, 16)) / zoom;
}
function placeVisible(meta, zoom) {
  return zoom >= meta.minZoom;
}

// Which names win when they'd overlap (lower is more important).
const PRIORITY = { capital: 0, city: 1, castle: 2, town: 3, port: 4, temple: 5, tower: 6, ruin: 7, dungeon: 7, landmark: 8, village: 9, camp: 10 };
const isBig = (kind) => kind === 'capital' || kind === 'city';
function nameFont(kind, fs) {
  return isBig(kind) ? `600 ${fs}px Cinzel, Georgia, serif` : `500 ${fs}px Lora, Georgia, serif`;
}
const nameSpacing = (kind) => (isBig(kind) ? 0.07 : 0.01);

// Name widths at a 100px reference size; real sizes scale linearly.
const nameWidthCache = new Map();
function nameWidth(kind, name, fs) {
  const key = `${isBig(kind) ? 'C' : 'L'}|${name}`;
  let w = nameWidthCache.get(key);
  if (w === undefined) {
    const m = measurer();
    m.font = nameFont(kind, 100);
    w = spacedWidth(m, name, 100, nameSpacing(kind));
    if (nameWidthCache.size > 4000) nameWidthCache.clear();
    nameWidthCache.set(key, w);
  }
  return w * fs / 100;
}

// ── Glyphs ──
// Drawn in a unit box (-0.5 … 0.5), scaled to the icon size, with the ground
// line near +0.38 so buildings sit on the map point. `lw` is the line width.

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function fillStroke(ctx, fill) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

// A house: wall with a shaded right side and a pitched roof.
function house(ctx, x, w, h, roofH, base = 0.38) {
  poly(ctx, [[x - w / 2, base], [x - w / 2, base - h], [x + w / 2, base - h], [x + w / 2, base]]);
  fillStroke(ctx, PAPER);
  ctx.beginPath(); ctx.rect(x + w * 0.12, base - h, w * 0.38, h); ctx.fillStyle = PAPER_SHADE; ctx.fill();
  ctx.beginPath(); ctx.rect(x - w / 2, base - h, w, h); ctx.stroke();
  poly(ctx, [[x - w / 2 - 0.03, base - h], [x, base - h - roofH], [x + w / 2 + 0.03, base - h]]);
  fillStroke(ctx, ROOF);
  poly(ctx, [[x, base - h - roofH], [x + w / 2 + 0.03, base - h], [x + w * 0.1, base - h]]);
  ctx.fillStyle = ROOF_SHADE; ctx.fill();
  poly(ctx, [[x - w / 2 - 0.03, base - h], [x, base - h - roofH], [x + w / 2 + 0.03, base - h]]);
  ctx.stroke();
}

// A crenellated tower or wall block from `top` down to `base`.
function battlement(ctx, x, w, top, base, merlons = 3) {
  const m = merlons * 2 - 1, step = w / m, dip = Math.min(step, 0.07);
  const pts = [[x - w / 2, base], [x - w / 2, top]];
  for (let i = 0; i < m; i++) {
    const x0 = x - w / 2 + i * step, x1 = x0 + step;
    if (i % 2) { pts.push([x0, top + dip], [x1, top + dip]); } else { pts.push([x0, top], [x1, top]); }
  }
  pts.push([x + w / 2, top], [x + w / 2, base]);
  poly(ctx, pts);
  fillStroke(ctx, PAPER);
  ctx.beginPath(); ctx.rect(x + w * 0.15, top + dip, w * 0.35, base - top - dip); ctx.fillStyle = PAPER_SHADE; ctx.fill();
  poly(ctx, pts); ctx.stroke();
}

function banner(ctx, x, top, h, color = BANNER) {
  ctx.beginPath(); ctx.moveTo(x, top + h); ctx.lineTo(x, top); ctx.stroke();
  poly(ctx, [[x, top], [x + 0.2, top + 0.035], [x + 0.13, top + 0.065], [x + 0.2, top + 0.1], [x, top + 0.11]]);
  fillStroke(ctx, color);
}

function spire(ctx, x, w, top, base, roofH) {
  poly(ctx, [[x - w / 2, base], [x - w / 2, top], [x + w / 2, top], [x + w / 2, base]]);
  fillStroke(ctx, PAPER);
  poly(ctx, [[x - w / 2 - 0.02, top], [x, top - roofH], [x + w / 2 + 0.02, top]]);
  fillStroke(ctx, ROOF);
}

function gate(ctx, x, w, base) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base); ctx.lineTo(x - w / 2, base - w * 0.7);
  ctx.arc(x, base - w * 0.7, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, base); ctx.closePath();
  ctx.fillStyle = INK; ctx.fill();
}

function ground(ctx, x0, x1, y) {
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
}

const GLYPHS = {
  capital(ctx) {
    // A walled city: curtain wall with corner towers, a tall keep and a banner.
    battlement(ctx, 0, 0.3, -0.2, 0.2, 3);
    banner(ctx, 0, -0.5, 0.3);
    house(ctx, -0.25, 0.18, 0.12, 0.12, 0.2);
    house(ctx, 0.25, 0.18, 0.16, 0.12, 0.2);
    battlement(ctx, 0, 0.84, 0.12, 0.4, 7);
    battlement(ctx, -0.4, 0.16, 0.02, 0.4, 2);
    battlement(ctx, 0.4, 0.16, 0.02, 0.4, 2);
    gate(ctx, 0, 0.12, 0.4);
  },
  city(ctx) {
    // A skyline behind a low wall: houses, a hall and a spire.
    house(ctx, -0.3, 0.2, 0.22, 0.12, 0.26);
    spire(ctx, -0.04, 0.14, -0.18, 0.26, 0.26);
    house(ctx, 0.2, 0.26, 0.3, 0.14, 0.26);
    house(ctx, 0.37, 0.14, 0.16, 0.1, 0.32);
    battlement(ctx, 0, 0.92, 0.22, 0.4, 7);
    gate(ctx, -0.1, 0.1, 0.4);
  },
  town(ctx) {
    house(ctx, -0.24, 0.26, 0.2, 0.16, 0.36);
    spire(ctx, 0.02, 0.12, -0.12, 0.36, 0.2);
    house(ctx, 0.25, 0.28, 0.26, 0.18, 0.38);
    ground(ctx, -0.44, 0.44, 0.39);
  },
  village(ctx) {
    house(ctx, -0.14, 0.34, 0.24, 0.22, 0.38);
    house(ctx, 0.22, 0.26, 0.18, 0.18, 0.4);
    ground(ctx, -0.38, 0.4, 0.4);
  },
  castle(ctx) {
    battlement(ctx, 0, 0.24, -0.26, 0.2, 2);
    banner(ctx, 0.02, -0.5, 0.24);
    battlement(ctx, 0, 0.76, 0.04, 0.4, 5);
    battlement(ctx, -0.33, 0.2, -0.14, 0.4, 2);
    battlement(ctx, 0.33, 0.2, -0.14, 0.4, 2);
    gate(ctx, 0, 0.14, 0.4);
    ctx.beginPath(); ctx.rect(-0.35, -0.03, 0.04, 0.08); ctx.rect(0.31, -0.03, 0.04, 0.08); ctx.fillStyle = INK; ctx.fill();
  },
  port(ctx) {
    // A harbour: a warehouse on the quay, a pier on posts and an anchor.
    house(ctx, -0.18, 0.3, 0.2, 0.14, 0.12);
    poly(ctx, [[-0.42, 0.12], [0.46, 0.12], [0.46, 0.18], [-0.42, 0.18]]);
    fillStroke(ctx, PAPER_SHADE);
    for (const x of [0.06, 0.22, 0.38]) { ctx.beginPath(); ctx.moveTo(x, 0.18); ctx.lineTo(x, 0.3); ctx.stroke(); }
    // anchor
    const ax = 0.24, ay = -0.2;
    ctx.beginPath(); ctx.arc(ax, ay - 0.13, 0.035, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay - 0.095); ctx.lineTo(ax, ay + 0.17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax - 0.07, ay - 0.04); ctx.lineTo(ax + 0.07, ay - 0.04); ctx.stroke();
    ctx.beginPath(); ctx.arc(ax, ay + 0.04, 0.13, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
    // water
    ctx.lineWidth *= 0.8;
    ctx.strokeStyle = WATER_INK;
    for (const [x, y] of [[-0.36, 0.3], [-0.12, 0.36], [0.16, 0.42]]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 0.06, y - 0.04, x + 0.12, y); ctx.quadraticCurveTo(x + 0.18, y + 0.04, x + 0.24, y); ctx.stroke();
    }
  },
  ruin(ctx) {
    // Broken columns and a fallen arch.
    const col = (x, top) => {
      poly(ctx, [[x - 0.06, 0.36], [x - 0.06, top + 0.03], [x - 0.02, top - 0.03], [x + 0.02, top + 0.02], [x + 0.06, top - 0.02], [x + 0.06, 0.36]]);
      fillStroke(ctx, PAPER);
      ctx.beginPath(); ctx.moveTo(x + 0.02, top + 0.05); ctx.lineTo(x + 0.02, 0.36); ctx.stroke();
    };
    ctx.beginPath(); ctx.arc(-0.1, -0.08, 0.24, Math.PI, Math.PI * 1.62); ctx.lineWidth *= 2.4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth /= 2.4;
    col(-0.34, -0.1);
    col(0.12, -0.32);
    col(0.34, 0.06);
    poly(ctx, [[-0.18, 0.36], [-0.14, 0.28], [-0.04, 0.3], [-0.02, 0.36]]); fillStroke(ctx, PAPER_SHADE);
    ground(ctx, -0.46, 0.46, 0.37);
  },
  tower(ctx) {
    // A tall mage tower with a conical roof.
    poly(ctx, [[-0.14, 0.4], [-0.1, -0.16], [0.1, -0.16], [0.14, 0.4]]);
    fillStroke(ctx, PAPER);
    poly(ctx, [[0.02, 0.4], [0.03, -0.16], [0.1, -0.16], [0.14, 0.4]]); ctx.fillStyle = PAPER_SHADE; ctx.fill();
    poly(ctx, [[-0.14, 0.4], [-0.1, -0.16], [0.1, -0.16], [0.14, 0.4]]); ctx.stroke();
    poly(ctx, [[-0.16, -0.16], [0, -0.5], [0.16, -0.16]]);
    fillStroke(ctx, ROOF);
    ctx.beginPath(); ctx.rect(-0.03, -0.05, 0.05, 0.1); ctx.rect(-0.02, 0.16, 0.05, 0.08); ctx.fillStyle = INK; ctx.fill();
    ground(ctx, -0.26, 0.26, 0.41);
  },
  temple(ctx) {
    poly(ctx, [[-0.42, -0.12], [0, -0.42], [0.42, -0.12]]);
    fillStroke(ctx, PAPER);
    ctx.beginPath(); ctx.arc(0, -0.21, 0.045, 0, Math.PI * 2); ctx.stroke();
    poly(ctx, [[-0.4, -0.12], [0.4, -0.12], [0.4, -0.05], [-0.4, -0.05]]); fillStroke(ctx, PAPER);
    for (const x of [-0.29, -0.1, 0.1, 0.29]) {
      poly(ctx, [[x - 0.04, -0.05], [x + 0.04, -0.05], [x + 0.04, 0.3], [x - 0.04, 0.3]]);
      fillStroke(ctx, x > 0 ? PAPER_SHADE : PAPER);
    }
    poly(ctx, [[-0.42, 0.3], [0.42, 0.3], [0.42, 0.35], [-0.42, 0.35]]); fillStroke(ctx, PAPER);
    poly(ctx, [[-0.47, 0.35], [0.47, 0.35], [0.47, 0.41], [-0.47, 0.41]]); fillStroke(ctx, PAPER_SHADE);
  },
  dungeon(ctx) {
    // A rocky crag with a dark cave mouth.
    poly(ctx, [[-0.47, 0.4], [-0.36, 0.06], [-0.2, -0.16], [-0.06, -0.12], [0.06, -0.34], [0.2, -0.18], [0.34, 0.02], [0.47, 0.4]]);
    fillStroke(ctx, PAPER);
    poly(ctx, [[0.06, -0.34], [0.2, -0.18], [0.34, 0.02], [0.47, 0.4], [0.18, 0.4], [0.16, 0.06]]);
    ctx.fillStyle = PAPER_SHADE; ctx.fill();
    poly(ctx, [[-0.47, 0.4], [-0.36, 0.06], [-0.2, -0.16], [-0.06, -0.12], [0.06, -0.34], [0.2, -0.18], [0.34, 0.02], [0.47, 0.4]]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.18, 0.4); ctx.quadraticCurveTo(-0.17, 0.06, 0, 0.03); ctx.quadraticCurveTo(0.17, 0.06, 0.18, 0.4);
    ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
    // teeth of rock in the mouth
    poly(ctx, [[-0.08, 0.06], [-0.05, 0.14], [-0.02, 0.05]]); ctx.fillStyle = PAPER; ctx.fill();
    poly(ctx, [[0.03, 0.05], [0.06, 0.13], [0.09, 0.07]]); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.3, 0.12); ctx.lineTo(-0.22, 0.04); ctx.moveTo(0.26, 0.1); ctx.lineTo(0.33, 0.18); ctx.stroke();
  },
  camp(ctx) {
    const tent = (x, w, h, base) => {
      poly(ctx, [[x - w / 2, base], [x, base - h], [x + w / 2, base]]);
      fillStroke(ctx, PAPER);
      poly(ctx, [[x, base - h], [x + w / 2, base], [x + w * 0.08, base]]); ctx.fillStyle = PAPER_SHADE; ctx.fill();
      poly(ctx, [[x, base - h], [x - w * 0.1, base], [x + w * 0.08, base]]); ctx.fillStyle = INK; ctx.fill();
      poly(ctx, [[x - w / 2, base], [x, base - h], [x + w / 2, base]]); ctx.stroke();
    };
    tent(-0.17, 0.5, 0.52, 0.36);
    banner(ctx, -0.17, -0.42, 0.26);
    tent(0.24, 0.36, 0.36, 0.38);
    // campfire
    poly(ctx, [[0.04, 0.4], [0.08, 0.28], [0.11, 0.34], [0.14, 0.26], [0.18, 0.4]]);
    ctx.fillStyle = '#c2672e'; ctx.fill();
    ground(ctx, -0.46, 0.46, 0.41);
  },
  landmark(ctx) {
    // An obelisk on a stepped plinth.
    poly(ctx, [[-0.1, 0.26], [-0.07, -0.32], [0, -0.46], [0.07, -0.32], [0.1, 0.26]]);
    fillStroke(ctx, PAPER);
    poly(ctx, [[0, -0.46], [0.07, -0.32], [0.1, 0.26], [0.02, 0.26], [0.01, -0.32]]); ctx.fillStyle = PAPER_SHADE; ctx.fill();
    poly(ctx, [[-0.1, 0.26], [-0.07, -0.32], [0, -0.46], [0.07, -0.32], [0.1, 0.26]]); ctx.stroke();
    poly(ctx, [[-0.2, 0.26], [0.2, 0.26], [0.2, 0.32], [-0.2, 0.32]]); fillStroke(ctx, PAPER);
    poly(ctx, [[-0.28, 0.32], [0.28, 0.32], [0.28, 0.4], [-0.28, 0.4]]); fillStroke(ctx, PAPER_SHADE);
  },
};

// A soft ink shadow under a glyph, so it sits on the land.
function glyphShadow(ctx, x, y, s) {
  ctx.beginPath();
  ctx.ellipse(x + s * 0.04, y + s * 0.4, s * 0.48, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fillStyle = SHADOW;
  ctx.fill();
}

function drawGlyph(ctx, place, s, zoom) {
  const glyph = GLYPHS[place.kind] || GLYPHS.town;
  glyphShadow(ctx, place.x, place.y, s);
  ctx.save();
  ctx.translate(place.x, place.y);
  ctx.scale(s, s);
  ctx.strokeStyle = INK;
  // ~1.1 px on screen, never heavier than a fifteenth of the icon.
  ctx.lineWidth = Math.min(0.065, 1.1 / (s * zoom));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  glyph(ctx);
  ctx.restore();
}

// ── Layout ──
// Names try right of the icon, then left, below and above; a name that would
// overlap a more important place's icon or name is dropped, and an icon that
// would sit on top of a more important icon is hidden too. The selected place
// always shows. Layout is cached for a given places array, zoom and selection.

let layoutCache = null;
function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function layoutPlaces(places, zoom, selectedId) {
  const c = layoutCache;
  if (c && c.places === places && c.zoom === zoom && c.sel === selectedId) return c.out;
  const pad = 2 / zoom;
  const items = [];
  for (const p of places) {
    const meta = PLACE_BY_KIND[p.kind] || PLACE_BY_KIND.town;
    if (p.id !== selectedId && !placeVisible(meta, zoom)) continue;
    items.push({ p, meta, sel: p.id === selectedId, pri: PRIORITY[p.kind] ?? 9 });
  }
  items.sort((a, b) => (b.sel - a.sel) || (a.pri - b.pri));
  const icons = [], boxes = [];
  const out = [];
  for (const it of items) {
    const { p, meta } = it;
    const s = placeSize(meta, zoom);
    const fs = placeLabelSize(meta, zoom) * (p.nameOnly ? 1.15 : 1);
    let icon = null;
    if (!p.nameOnly) {
      icon = { x0: p.x - s * 0.42, x1: p.x + s * 0.42, y0: p.y - s * 0.45, y1: p.y + s * 0.42 };
      // Hide an icon mostly covered by a more important one.
      if (!it.sel && icons.some(o => overlaps(o, icon) &&
        (Math.min(o.x1, icon.x1) - Math.max(o.x0, icon.x0)) * (Math.min(o.y1, icon.y1) - Math.max(o.y0, icon.y0)) > (icon.x1 - icon.x0) * (icon.y1 - icon.y0) * 0.35)) continue;
      icons.push(icon);
      boxes.push(icon);
    }
    let label = null;
    if (p.name) {
      const w = nameWidth(p.kind, p.name, fs);
      const h = fs * 0.95;
      const cands = p.nameOnly
        ? [{ x: p.x - w / 2, y: p.y }]
        : [
          { x: p.x + s * 0.5, y: p.y },
          { x: p.x - s * 0.5 - w, y: p.y },
          { x: p.x - w / 2, y: p.y + s * 0.42 + h * 0.65 },
          { x: p.x - w / 2, y: p.y - s * 0.5 - h * 0.6 },
        ];
      for (const cand of cands) {
        const box = { x0: cand.x - pad, x1: cand.x + w + pad, y0: cand.y - h / 2 - pad, y1: cand.y + h / 2 + pad };
        // The name sits beside its own icon by design, so only others count.
        if (!boxes.some(o => o !== icon && overlaps(o, box))) { label = { ...cand, w, h, box }; break; }
      }
      if (!label && it.sel) {
        const cand = cands[0];
        label = { ...cand, w, h, box: { x0: cand.x, x1: cand.x + w, y0: cand.y - h / 2, y1: cand.y + h / 2 } };
      }
      if (label) boxes.push(label.box);
      else if (p.nameOnly) continue; // nothing to show
    }
    out.push({ p, s, fs, icon, label });
  }
  layoutCache = { places, zoom, sel: selectedId, out };
  return out;
}

function drawName(ctx, item) {
  const { p, fs, label } = item;
  ctx.font = nameFont(p.kind, fs);
  ctx.textBaseline = 'middle';
  haloText(ctx, p.name, label.x, label.y, fs, {
    spacing: nameSpacing(p.kind), halo: p.nameOnly ? 0.34 : 0.3,
  });
}

/** Draws places that are visible at this zoom, with their names. */
export function drawPlaces(ctx, places, view, { selectedId, preview } = {}) {
  if (!places?.length) return;
  ctx.save();
  if (preview) {
    // Picker previews: one glyph, no shadow or layout.
    for (const p of places) {
      // Fill most of the preview box, whatever the kind's map size.
      const s = (view.width * 0.82) / view.zoom;
      const glyph = GLYPHS[p.kind] || GLYPHS.town;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.scale(s, s);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.min(0.065, 1.1 / (s * view.zoom)); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      glyph(ctx);
      ctx.restore();
    }
    ctx.restore();
    return;
  }
  const items = layoutPlaces(places, view.zoom, selectedId);
  const onScreen = (b) => visible({ minX: b.x0, maxX: b.x1, minY: b.y0, maxY: b.y1 }, view, 0);
  // Icons back to front, then every name on top so no icon covers a name.
  const icons = items.filter(it => it.icon && onScreen(it.icon)).sort((a, b) => a.p.y - b.p.y);
  for (const it of icons) drawGlyph(ctx, it.p, it.s, view.zoom);
  for (const it of items) if (it.label && onScreen(it.label.box)) drawName(ctx, it);
  ctx.restore();
}

// ── Labels ────────────────────────────────────────────────────────────────────

function labelFont(styleMeta, size) {
  return styleMeta.font.replace('{s}', String(size));
}
function labelText(label, styleMeta) {
  const t = label.text || '';
  return styleMeta.caps ? t.toUpperCase() : t;
}
function labelLines(label, styleMeta) {
  return labelText(label, styleMeta).split('\n');
}

// Halo per label style: sea names sit straight on the water (a parchment halo
// there looks muddy); realm names are big enough to need only a whisper.
const LABEL_HALO = { realm: 0.12, region: 0.2, sea: 0, place: 0.26 };

/** Free text labels: realm and region names, seas, notes. */
export function drawLabels(ctx, labels, view) {
  if (!labels?.length) return;
  ctx.save();
  for (const l of labels) {
    const meta = LABEL_BY_STYLE[l.style] || LABEL_BY_STYLE.place;
    const size = l.size || meta.defaultSize;
    if (size * view.zoom < 7) continue;
    const lines = labelLines(l, meta);
    const longest = Math.max(...lines.map(s => s.length));
    const pad = size * longest * (0.8 + meta.spacing);
    if (!visible({ minX: l.x, maxX: l.x, minY: l.y, maxY: l.y }, view, pad)) continue;
    ctx.save();
    ctx.translate(l.x, l.y);
    if (l.angle) ctx.rotate(l.angle);
    ctx.font = labelFont(meta, size);
    ctx.textBaseline = 'middle';
    const lh = size * 1.15;
    const y0 = -((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      haloText(ctx, line, 0, y0 + i * lh, size, {
        spacing: meta.spacing, color: l.color || meta.color, align: 'center', halo: LABEL_HALO[meta.style] ?? 0.24,
      });
    });
    ctx.restore();
  }
  ctx.restore();
}

// Label box in its own (unrotated) frame, centred on the label point.
function labelBox(l) {
  const meta = LABEL_BY_STYLE[l.style] || LABEL_BY_STYLE.place;
  const size = l.size || meta.defaultSize;
  const m = measurer();
  m.font = labelFont(meta, size);
  const lines = labelLines(l, meta);
  const w = Math.max(...lines.map(line => spacedWidth(m, line, size, meta.spacing)), size * 0.5);
  const h = lines.length * size * 1.15;
  return { w, h, size };
}

// ── Selection & hit testing ───────────────────────────────────────────────────

function dashed(ctx, zoom) {
  ctx.strokeStyle = BRAND;
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
}

function handle(ctx, x, y, zoom) {
  const r = 4 / zoom;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeStyle = BRAND;
  ctx.stroke();
}

/** Dashed brand outline and handles around the selected item. */
export function drawSelection(ctx, item, type, view) {
  if (!item) return;
  const z = view.zoom;
  ctx.save();
  if (type === 'place') {
    const meta = PLACE_BY_KIND[item.kind] || PLACE_BY_KIND.town;
    const s = placeSize(meta, z);
    dashed(ctx, z);
    ctx.beginPath();
    ctx.arc(item.x, item.y, s * 0.62 + 3 / z, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'label') {
    const { w, h } = labelBox(item);
    ctx.translate(item.x, item.y);
    if (item.angle) ctx.rotate(item.angle);
    const pad = 6 / z;
    dashed(ctx, z);
    ctx.strokeRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
    // Rotation handle above the box.
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, -h / 2 - pad); ctx.lineTo(0, -h / 2 - pad - 18 / z); ctx.stroke();
    handle(ctx, 0, -h / 2 - pad - 18 / z, z);
  } else if (type === 'path' && item.points?.length) {
    dashed(ctx, z);
    ctx.stroke(smoothPath(item.points));
    for (const [x, y] of item.points) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, 2.5 / z, 0, Math.PI * 2);
      ctx.fillStyle = BRAND;
      ctx.fill();
    }
    handle(ctx, item.points[0][0], item.points[0][1], z);
    const last = item.points[item.points.length - 1];
    handle(ctx, last[0], last[1], z);
  }
  ctx.restore();
}

/** World position of a label's rotation handle (for dragging it). */
export function labelRotateHandle(label, view) {
  const { h } = labelBox(label);
  const z = view.zoom;
  const d = h / 2 + 6 / z + 18 / z;
  const a = label.angle || 0;
  return [label.x + Math.sin(a) * d, label.y - Math.cos(a) * d];
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

/**
 * What's under world point (wx, wy): places first, then labels, then paths.
 * Returns { type, id } or null. Hidden (zoomed-out) places aren't hit.
 */
export function hitTest({ paths = [], places = [], labels = [] }, wx, wy, view) {
  const z = view.zoom;
  const tol = 8 / z;

  // Places, as laid out on screen (most important last drawn wins).
  const items = layoutPlaces(places, z, layoutCache?.places === places && layoutCache?.zoom === z ? layoutCache.sel : null);
  for (let i = items.length - 1; i >= 0; i--) {
    const { p, icon, label } = items[i];
    const grow = tol * 0.4;
    if (icon && wx >= icon.x0 - grow && wx <= icon.x1 + grow && wy >= icon.y0 - grow && wy <= icon.y1 + grow) return { type: 'place', id: p.id };
    if (label && wx >= label.box.x0 - grow && wx <= label.box.x1 + grow && wy >= label.box.y0 - grow && wy <= label.box.y1 + grow) return { type: 'place', id: p.id };
  }
  for (const p of places) {
    // A nameless, name-only place still needs a handle.
    if (p.nameOnly && !p.name && Math.hypot(wx - p.x, wy - p.y) <= tol * 2) return { type: 'place', id: p.id };
  }

  for (let i = labels.length - 1; i >= 0; i--) {
    const l = labels[i];
    const meta = LABEL_BY_STYLE[l.style] || LABEL_BY_STYLE.place;
    if ((l.size || meta.defaultSize) * z < 7) continue;
    const { w, h } = labelBox(l);
    const a = -(l.angle || 0);
    const dx = wx - l.x, dy = wy - l.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= w / 2 + tol * 0.5 && Math.abs(ly) <= h / 2 + tol * 0.5) return { type: 'label', id: l.id };
  }

  const sorted = paths.map((p, i) => [p, i]).sort((a, b) => (PATH_ORDER[b[0].kind] ?? 9) - (PATH_ORDER[a[0].kind] ?? 9) || b[1] - a[1]);
  for (const [p] of sorted) {
    const pts = p.points;
    if (!pts?.length) continue;
    const reach = Math.max(tol, (p.width || 6) * (p.kind === 'border' ? 1.6 : 0.6));
    const b = cachedBounds(pts);
    if (wx < b.minX - reach || wx > b.maxX + reach || wy < b.minY - reach || wy > b.maxY + reach) continue;
    const d = densePoints(pts);
    const r2 = reach * reach;
    if (d.length === 1 && (wx - d[0][0]) ** 2 + (wy - d[0][1]) ** 2 <= r2) return { type: 'path', id: p.id };
    for (let i = 1; i < d.length; i++) {
      if (segDist2(wx, wy, d[i - 1][0], d[i - 1][1], d[i][0], d[i][1]) <= r2) return { type: 'path', id: p.id };
    }
  }
  return null;
}
