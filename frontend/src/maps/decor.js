// Decoration for exported maps: a parchment margin with a ruled, checkered
// frame, a compass rose in the emptiest corner, a scale bar and a title
// cartouche. Drawn in canvas pixels after the map itself; only PNG export uses
// it (thumbnails and the editor stay plain).

const INK = '#4a3b2a';
const PAPER = '#efe4c4';
const PAPER_DARK = '#dccb9f';

// The builder has no real-world units, so the scale bar assumes one world unit
// is a quarter mile: a generated continent (~9000 units) is ~2250 miles across.
export const MILES_PER_UNIT = 0.25;

/**
 * Space the decoration needs around the map, in pixels, for an image of
 * w × h pixels: `margin` on every side plus `titleBand` at the top.
 */
export function decorSpace(w, h, title) {
  const margin = Math.round(Math.max(28, Math.min(120, Math.max(w, h) * 0.03)));
  const titleBand = title ? Math.round(margin * 2.4) : 0;
  return { margin, titleBand };
}

/**
 * Draws the decoration over a rendered map.
 * rect/scale describe the canvas (world rect at `scale` px per unit);
 * landAt(wx, wy) says whether a world point is land, to keep the compass at sea.
 */
export function drawDecor(ctx, rect, scale, { title, margin, titleBand = 0, landAt } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const m = margin ?? decorSpace(W, H, title).margin;
  const u = Math.max(1, Math.min(W, H) / 1400); // line unit
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  frame(ctx, W, H, m, u);
  const inner = { x0: m, y0: m, x1: W - m, y1: H - m };

  // Pick the corner with the least land for the compass; the scale bar takes
  // the other bottom corner.
  const R = Math.max(36, Math.min(W, H) * 0.07);
  const toWorld = (px, py) => [rect.minX + px / scale, rect.minY + py / scale];
  const pad = R * 1.35;
  const corners = [
    { id: 'tl', x: inner.x0 + pad, y: inner.y0 + titleBand + pad },
    { id: 'tr', x: inner.x1 - pad, y: inner.y0 + titleBand + pad },
    { id: 'bl', x: inner.x0 + pad, y: inner.y1 - pad },
    { id: 'br', x: inner.x1 - pad, y: inner.y1 - pad },
  ];
  for (const c of corners) {
    let land = 0, n = 0;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const [wx, wy] = toWorld(c.x + (i / 3) * R * 1.2, c.y + (j / 3) * R * 1.2);
      n++;
      if (landAt && landAt(wx, wy)) land++;
    }
    c.land = land / n;
  }
  const best = corners.slice().sort((a, b) => a.land - b.land || (a.id === 'tr' ? -1 : 0))[0];
  compassRose(ctx, best.x, best.y, R, u);

  const barCorner = best.id === 'bl' ? 'br' : 'bl';
  scaleBar(ctx, scale, barCorner === 'bl' ? inner.x0 + m * 0.6 : inner.x1 - m * 0.6, inner.y1 - m * 0.55, barCorner, W, u);

  if (title) cartouche(ctx, title, W / 2, inner.y0 + titleBand / 2 + m * 0.15, titleBand * 0.62, W, u);
  ctx.restore();
}

// ── Frame ─────────────────────────────────────────────────────────────────────

function frame(ctx, W, H, m, u) {
  // Parchment margin.
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(m, m, W - 2 * m, H - 2 * m);
  ctx.fill('evenodd');

  // A faint shadow where the map meets the margin.
  const sh = Math.max(2, m * 0.12);
  ctx.strokeStyle = 'rgba(74, 59, 42, 0.18)';
  ctx.lineWidth = sh;
  ctx.strokeRect(m + sh / 2, m + sh / 2, W - 2 * m - sh, H - 2 * m - sh);

  ctx.strokeStyle = INK;
  // Inner rule on the map edge.
  ctx.lineWidth = 1.2 * u;
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);

  // Checkered band, like the degree border of an old chart.
  const a = m * 0.38, b = m * 0.62, band = b - a;
  ctx.lineWidth = 1 * u;
  ctx.strokeRect(a, a, W - 2 * a, H - 2 * a);
  ctx.strokeRect(b, b, W - 2 * b, H - 2 * b);
  const seg = Math.max(band * 3, 18 * u);
  ctx.fillStyle = INK;
  const run = (x0, y0, len, horizontal) => {
    for (let t = 0, k = 0; t < len; t += seg, k++) {
      if (k % 2) continue;
      const l = Math.min(seg, len - t);
      if (horizontal) ctx.fillRect(x0 + t, y0, l, band);
      else ctx.fillRect(x0, y0 + t, band, l);
    }
  };
  run(b, a, W - 2 * b, true);
  run(b, H - b, W - 2 * b, true);
  run(a, b, H - 2 * b, false);
  run(W - b, b, H - 2 * b, false);
  // Corner blocks.
  for (const [x, y] of [[a, a], [W - b, a], [a, H - b], [W - b, H - b]]) {
    ctx.fillRect(x, y, band, band);
  }

  // Outer heavy rule.
  ctx.lineWidth = 2.4 * u;
  const o = m * 0.2;
  ctx.strokeRect(o, o, W - 2 * o, H - 2 * o);
}

// ── Compass rose ──────────────────────────────────────────────────────────────

function compassRose(ctx, cx, cy, R, u) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';

  // Soft paper backing so the rose reads over land too.
  const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.05);
  g.addColorStop(0, 'rgba(239, 228, 196, 0.55)');
  g.addColorStop(1, 'rgba(239, 228, 196, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R * 1.05, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = INK;
  // Rings and ticks.
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * Math.PI * 2;
    const long = i % 18 === 0 ? 0.13 : i % 9 === 0 ? 0.09 : 0.05;
    ctx.lineWidth = (i % 9 === 0 ? 1.2 : 0.7) * u;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * R * 0.7, Math.sin(ang) * R * 0.7);
    ctx.lineTo(Math.cos(ang) * R * (0.7 - long), Math.sin(ang) * R * (0.7 - long));
    ctx.stroke();
  }

  // Points: each is a kite split down the middle, one half inked.
  const point = (ang, len, half, shadeLeft) => {
    const tip = [Math.cos(ang) * len, Math.sin(ang) * len];
    const l = [Math.cos(ang - Math.PI / 2) * half, Math.sin(ang - Math.PI / 2) * half];
    const r = [Math.cos(ang + Math.PI / 2) * half, Math.sin(ang + Math.PI / 2) * half];
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l[0], l[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath();
    ctx.fillStyle = shadeLeft ? INK : PAPER; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r[0], r[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath();
    ctx.fillStyle = shadeLeft ? PAPER : INK; ctx.fill(); ctx.stroke();
  };
  ctx.lineWidth = 1 * u;
  for (let i = 0; i < 8; i++) point(-Math.PI / 2 + Math.PI / 8 + (i * Math.PI) / 4, R * 0.42, R * 0.045, i % 2 === 0);
  for (let i = 0; i < 4; i++) point(-Math.PI / 4 + (i * Math.PI) / 2, R * 0.66, R * 0.08, i % 2 === 1);
  for (let i = 0; i < 4; i++) point(-Math.PI / 2 + (i * Math.PI) / 2, R * 1.0, R * 0.12, i % 2 === 0);

  ctx.beginPath(); ctx.arc(0, 0, R * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * 0.025, 0, Math.PI * 2);
  ctx.fillStyle = INK; ctx.fill();

  // North.
  const fs = R * 0.3;
  ctx.font = `600 ${fs}px Cinzel, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = fs * 0.22;
  ctx.strokeStyle = 'rgba(239, 228, 196, 0.9)';
  ctx.strokeText('N', 0, -R * 1.06);
  ctx.fillStyle = INK;
  ctx.fillText('N', 0, -R * 1.06);
  ctx.restore();
}

// ── Scale bar ─────────────────────────────────────────────────────────────────

function niceNumber(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}

function scaleBar(ctx, scale, x, y, corner, W, u) {
  const targetPx = W * 0.16;
  const miles = niceNumber((targetPx / scale) * MILES_PER_UNIT);
  const len = (miles / MILES_PER_UNIT) * scale;
  const h = Math.max(5, 6 * u);
  const x0 = corner === 'bl' ? x : x - len;
  const fs = Math.max(11, 13 * u);

  ctx.save();
  // Paper backing.
  ctx.fillStyle = 'rgba(239, 228, 196, 0.8)';
  const bx = x0 - fs * 0.8, by = y - h - fs * 2.1;
  ctx.fillRect(bx, by, len + fs * 1.6, h + fs * 2.6);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 ? PAPER : INK;
    ctx.fillRect(x0 + (len * i) / segs, y - h, len / segs, h);
  }
  ctx.strokeRect(x0, y - h, len, h);

  ctx.fillStyle = INK;
  ctx.font = `italic 500 ${fs}px Lora, Georgia, serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillText('0', x0, y - h - fs * 0.45);
  ctx.fillText(String(miles / 2), x0 + len / 2, y - h - fs * 0.45);
  ctx.fillText(String(miles), x0 + len, y - h - fs * 0.45);
  ctx.textAlign = 'left';
  ctx.font = `600 ${fs * 0.8}px Cinzel, Georgia, serif`;
  ctx.fillText('MILES', x0, y + fs * 0.95);
  ctx.restore();
}

// ── Title cartouche ───────────────────────────────────────────────────────────

function cartouche(ctx, title, cx, cy, h, W, u) {
  const text = title.toUpperCase();
  let fs = h * 0.5;
  ctx.save();
  const spacing = 0.18;
  const measure = () => {
    ctx.font = `600 ${fs}px Cinzel, Georgia, serif`;
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + spacing * fs;
    return w - spacing * fs;
  };
  let tw = measure();
  if (tw > W * 0.6) { fs *= (W * 0.6) / tw; tw = measure(); }
  const bw = tw + h * 1.6;
  const x0 = cx - bw / 2, x1 = cx + bw / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const curl = h * 0.32;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4 * u;

  // Ribbon tails folded behind the scroll.
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 : x1;
    ctx.beginPath();
    ctx.moveTo(ex - side * curl * 0.2, y0 + h * 0.3);
    ctx.lineTo(ex + side * h * 0.9, y0 + h * 0.3);
    ctx.lineTo(ex + side * h * 0.62, cy + h * 0.32);
    ctx.lineTo(ex + side * h * 0.9, y1 + h * 0.34);
    ctx.lineTo(ex - side * curl * 0.2, y1 + h * 0.34);
    ctx.closePath();
    ctx.fillStyle = PAPER_DARK; ctx.fill(); ctx.stroke();
  }

  // Scroll body with rolled ends.
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.quadraticCurveTo(x1 + curl, cy, x1, y1);
  ctx.lineTo(x0, y1);
  ctx.quadraticCurveTo(x0 - curl, cy, x0, y0);
  ctx.closePath();
  ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 : x1;
    ctx.beginPath();
    ctx.ellipse(ex, y1 - curl * 0.55, curl * 0.42, curl * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = PAPER_DARK; ctx.fill(); ctx.stroke();
  }
  // Inner rule.
  ctx.lineWidth = 0.8 * u;
  ctx.strokeRect(x0 + h * 0.18, y0 + h * 0.14, bw - h * 0.36, h - h * 0.28);

  // Title.
  ctx.fillStyle = INK;
  ctx.font = `600 ${fs}px Cinzel, Georgia, serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let x = cx - tw / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, cy + fs * 0.05);
    x += ctx.measureText(ch).width + spacing * fs;
  }
  ctx.restore();
}
