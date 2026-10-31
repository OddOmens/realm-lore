// Image stamps on the map builder: PNG/SVG files from the server's stamp
// library (src 'png', ref = library path) and SVGs uploaded into the world
// (src 'svg', ref = custom stamp id). Drawn on the canvas in world units.

import { api } from '../lib/api';

// Strips the obvious script vectors from an uploaded SVG. It's only ever drawn
// as an <img>, which doesn't run scripts, so this is belt-and-braces.
export function sanitizeSvg(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|xlink:href|src)\s*=\s*"javascript:[^"]*"/gi, '$1=""')
    .replace(/(href|xlink:href|src)\s*=\s*'javascript:[^']*'/gi, "$1=''")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .trim();
}

export function svgToDataUri(svg) {
  return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : '';
}

/**
 * Loads stamp images on demand. `onLoad` is called whenever one finishes so
 * the editor can redraw. get() returns a loaded HTMLImageElement or null.
 */
export function createStampImages(onLoad) {
  const cache = new Map(); // cacheKey → { img, ready } | 'loading' | 'failed'
  let customById = {};

  const load = (key, srcPromise) => {
    cache.set(key, 'loading');
    srcPromise.then(src => {
      if (!src) { cache.set(key, 'failed'); return; }
      const img = new Image();
      img.onload = () => { cache.set(key, { img }); onLoad?.(); };
      img.onerror = () => cache.set(key, 'failed');
      img.src = src;
    }).catch(() => cache.set(key, 'failed'));
  };

  return {
    setCustomStamps(list) {
      customById = Object.fromEntries((list || []).map(s => [s.id, s]));
    },
    get(stamp) {
      const key = `${stamp.src}:${stamp.ref}`;
      const hit = cache.get(key);
      if (hit && typeof hit === 'object') return hit.img;
      if (hit) return null;
      if (stamp.src === 'svg') {
        const def = customById[stamp.ref];
        if (!def) return null; // the custom stamp was deleted; hide it
        load(key, Promise.resolve(svgToDataUri(sanitizeSvg(def.svg))));
      } else {
        load(key, api.stampsImage(stamp.ref).then(r => r?.dataUrl));
      }
      return null;
    },
  };
}

export function drawStamps(ctx, stamps, images, view, { selectedId } = {}) {
  for (const s of stamps) {
    const img = images.get(s);
    if (!img) continue;
    const size = s.size || 48;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
    const w = ratio >= 1 ? size : size * ratio;
    const h = ratio >= 1 ? size / ratio : size;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.rotation) ctx.rotate(s.rotation * Math.PI / 180);
    ctx.scale(s.flipX ? -1 : 1, s.flipY ? -1 : 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    if (s.id === selectedId) {
      ctx.save();
      ctx.strokeStyle = '#3b5bdb';
      ctx.lineWidth = 1.5 / view.zoom;
      ctx.setLineDash([4 / view.zoom, 3 / view.zoom]);
      ctx.strokeRect(s.x - size / 2 - 4, s.y - size / 2 - 4, size + 8, size + 8);
      ctx.restore();
    }
  }
}

/** Top-most stamp under world point (wx, wy). */
export function hitStamp(stamps, wx, wy) {
  for (let i = stamps.length - 1; i >= 0; i--) {
    const s = stamps[i];
    const half = (s.size || 48) / 2;
    if (Math.abs(wx - s.x) <= half && Math.abs(wy - s.y) <= half) return s;
  }
  return null;
}
