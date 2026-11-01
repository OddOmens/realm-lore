// Lays out a map from the world's Locations, by rules (no AI): each place's
// terrain comes from its "On the map" fields or the words in its entry, places
// sit near the locations they mention, settlements are linked by roads, and
// coastal places end up on the coast. The same locations and seed always give
// the same map.

import { CELL, BIOME, BIOMES, fbm, valueNoise } from './terrain';
import { simplifyPoints } from './features';

// ── Reading the entries ───────────────────────────────────────────────────────

const SETTLEMENT = new Set(['City', 'Town', 'Village', 'Castle', 'Port', 'Capital']);
const NEVER = new Set(['Plane', 'Ocean']);

const MARKER_BY_TYPE = {
  City: 'city', Capital: 'capital', Town: 'town', Village: 'village', Castle: 'castle', Port: 'port',
  Tavern: 'inn', Dungeon: 'dungeon', Cave: 'cave', Ruin: 'ruin', Shrine: 'shrine', Mine: 'mine',
  Battlefield: 'battle', Landmark: 'landmark', Lighthouse: 'lighthouse', Bridge: 'bridge', Farm: 'farm',
};
// Wide areas get just their name written over them.
const AREA_TYPES = new Set(['Forest', 'Mountain', 'Desert', 'Lake', 'Region']);

// Words that suggest each terrain. Region and terrain fields count triple.
const WORDS = [
  [BIOME.SNOWPEAKS, /\b(snow[- ]?capped|glacier|glacial)\b/],
  [BIOME.MOUNTAINS, /\b(mountains?|peaks?|crags?|alpine|summit|rocky slopes?)\b/],
  [BIOME.HILLS, /\b(hills?|hilly|foothills?|highlands?|downs)\b/],
  [BIOME.SNOW, /\b(snow\w*|ice|icy|frozen|frost\w*|arctic|winter)\b/],
  [BIOME.TUNDRA, /\b(tundra|permafrost|steppe)\b/],
  [BIOME.PINE, /\b(pines?|evergreen|conifers?|coniferous|taiga|firs?)\b/],
  [BIOME.FOREST, /\b(forest\w*|woods?|woodlands?|groves?|canopy|old-growth|trees?)\b/],
  [BIOME.JUNGLE, /\b(jungles?|rainforests?|tropical)\b/],
  [BIOME.DEADWOOD, /\b(dead (forest|trees|wood)|blight\w*|withered|petrified)\b/],
  [BIOME.SWAMP, /\b(swamps?|marsh\w*|bogs?|bogland|fens?|wetlands?|mires?|reeds?)\b/],
  [BIOME.MOOR, /\b(moors?|moorland|heath\w*|heather)\b/],
  [BIOME.DESERT, /\b(deserts?|dunes?|sands?|sandy)\b/],
  [BIOME.SAVANNA, /\b(savann?ahs?|acacia)\b/],
  [BIOME.BADLANDS, /\b(badlands|canyons?|mesas?|red rock)\b/],
  [BIOME.ASH, /\b(ash|ashen|cinders?|soot)\b/],
  [BIOME.VOLCANIC, /\b(volcan\w*|lava|magma|molten)\b/],
  [BIOME.FARMLAND, /\b(farms?|farmland|fields|orchards?|vineyards?|pastures?)\b/],
  [BIOME.GRASS, /\b(plains?|prairies?|meadows?|grassland|open country)\b/],
  [BIOME.LAKE, /\b(lake|loch|lagoon)\b/],
];
const COAST_WORDS = /\b(coast\w*|sea|seaside|ocean|harbou?r|port|beach|shore\w*|bay|cove|tide\w*|fishing|cliffs?)\b/;

const TERRAIN_BY_LABEL = Object.fromEntries(BIOMES.map(b => [b.label.toLowerCase(), b.id]));
const DIRS = {
  north: [0, -1], 'north-east': [0.71, -0.71], east: [1, 0], 'south-east': [0.71, 0.71],
  south: [0, 1], 'south-west': [-0.71, 0.71], west: [-1, 0], 'north-west': [-0.71, -0.71],
};
const DISTANCE = { 'right beside it': 140, nearby: 450, 'a day away': 1300, far: 2600 };

const clean = (s) => String(s || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
const linksIn = (s) => [...String(s || '').matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(m => m[1].trim().toLowerCase());

function scoreTerrain(loc) {
  const strong = clean(`${loc.region} ${loc.terrain} ${loc.name}`).toLowerCase();
  const weak = clean(`${loc.description} ${loc.atmosphere}`).toLowerCase();
  const score = new Map();
  for (const [b, re] of WORDS) {
    const g = new RegExp(re.source, 'g');
    const n = (strong.match(g) || []).length * 3 + (weak.match(g) || []).length;
    if (n) score.set(b, n);
  }
  // snowy mountains are their own terrain
  const snow = score.get(BIOME.SNOW) || 0, mount = score.get(BIOME.MOUNTAINS) || 0;
  if (snow && mount) score.set(BIOME.SNOWPEAKS, (score.get(BIOME.SNOWPEAKS) || 0) + snow + mount);
  // a lake only takes over when the place is a lake
  if (!/\b(lake|loch|lagoon)\b/i.test(`${loc.name} ${loc.type}`)) score.delete(BIOME.LAKE);
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
}

/** Reads one location entry into what the layout needs. */
export function describeLocation(loc) {
  const type = loc.type || 'Other';
  const pick = (v) => (v && v !== 'Auto' && v !== 'Any' ? v : null);
  let ranked = scoreTerrain(loc);
  // towns sit below the peaks, not on them
  const HIGH = [BIOME.MOUNTAINS, BIOME.SNOWPEAKS, BIOME.VOLCANIC];
  if (SETTLEMENT.has(type) && HIGH.includes(ranked[0])) {
    const low = ranked.find(b => !HIGH.includes(b) && b !== BIOME.SNOW);
    ranked = [low ?? BIOME.HILLS, ...ranked.filter(b => b !== low)];
  }
  // a place called a lake is one, whatever its marshy surroundings
  if (/\b(lake|loch|lagoon)\b/i.test(`${loc.name} ${type}`) && ranked[0] !== BIOME.LAKE) ranked = [BIOME.LAKE, ...ranked.filter(b => b !== BIOME.LAKE)];
  const chosen = pick(loc.mapTerrain) && TERRAIN_BY_LABEL[loc.mapTerrain.toLowerCase()];
  const terrain = chosen ?? ranked[0] ?? (type === 'Mountain' ? BIOME.MOUNTAINS : type === 'Forest' ? BIOME.FOREST : type === 'Desert' ? BIOME.DESERT : BIOME.GRASS);
  const secondary = ranked.find(b => b !== terrain && b !== BIOME.LAKE) ?? null;
  const text = clean(`${loc.region} ${loc.terrain} ${loc.description} ${loc.atmosphere} ${loc.notablePOI}`).toLowerCase();
  const coastWant = pick(loc.mapCoast);
  const coastal = coastWant ? coastWant === 'On the coast' : type === 'Port' || COAST_WORDS.test(clean(`${loc.region} ${loc.terrain} ${loc.description}`).toLowerCase());
  const isLake = terrain === BIOME.LAKE || type === 'Lake';
  let marker = pick(loc.mapMarker)?.toLowerCase().replace('battlefield', 'battle') || MARKER_BY_TYPE[type] || (AREA_TYPES.has(type) || isLake ? null : 'landmark');
  if (marker === 'city' && /\bcapital\b/.test(text)) marker = 'capital';
  if ((marker === 'town' || marker === 'village') && coastal) marker = 'port';
  const auto = !pick(loc.mapInclude);
  const include = auto
    ? !NEVER.has(type) && !(type === 'Other' && !loc.region && !pick(loc.mapTerrain) && !loc.mapNear)
    : loc.mapInclude === 'Yes';
  return {
    id: loc.id, name: loc.name || 'Unnamed', type, terrain, secondary, coastal, isLake, include,
    marker, settlement: SETTLEMENT.has(type) || marker === 'city' || marker === 'capital' || marker === 'town' || marker === 'village' || marker === 'port',
    near: pick(loc.mapNear) ? loc.mapNear.trim().toLowerCase() : null,
    direction: pick(loc.mapDirection) ? DIRS[loc.mapDirection.toLowerCase()] || null : null,
    distance: pick(loc.mapDistance) ? DISTANCE[loc.mapDistance.toLowerCase()] ?? null : null,
    roads: String(loc.mapRoads || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    region: clean(loc.region).toLowerCase(),
    links: linksIn(`${loc.region} ${loc.description} ${loc.notablePOI} ${loc.notes}`),
    text,
  };
}

// How far a child sits from what it's near, from words in its entry.
function distanceFromText(text) {
  if (/\bhalf[- ]a?[- ]?day\b/.test(text)) return 750;
  if (/\b(a day'?s?|day'?s journey|days? away)\b/.test(text)) return 1300;
  if (/\b(beneath|underneath|below|inside|atop|under)\W{1,3}(the|its|this)\b/.test(text)) return 150;
  if (/\b(just off|next to|beside|edge of|base of|foot of|outskirts|surrounds?)\b/.test(text)) return 380;
  return 550;
}
const DIR_WORDS = /\b(north|south|east|west|north-east|north-west|south-east|south-west|northeast|northwest|southeast|southwest) of\b/;

// Where each terrain prefers to sit on the continent (unit-ish vectors).
const ZONE = {
  [BIOME.SNOW]: [0, -1], [BIOME.TUNDRA]: [-0.2, -1], [BIOME.SNOWPEAKS]: [0.2, -0.95], [BIOME.MOUNTAINS]: [0.35, -0.8],
  [BIOME.PINE]: [-0.3, -0.8], [BIOME.HILLS]: [-0.3, -0.45], [BIOME.MOOR]: [-0.6, -0.5],
  [BIOME.FOREST]: [-0.9, -0.1], [BIOME.DEADWOOD]: [-0.8, 0.4], [BIOME.JUNGLE]: [0.3, 0.9],
  [BIOME.SWAMP]: [-0.2, 0.8], [BIOME.DESERT]: [0.75, 0.6], [BIOME.SAVANNA]: [0.6, 0.75],
  [BIOME.BADLANDS]: [0.9, 0.2], [BIOME.ASH]: [0.95, -0.05], [BIOME.VOLCANIC]: [0.9, -0.35],
  [BIOME.FARMLAND]: [0.1, 0.1], [BIOME.GRASS]: [0, 0], [BIOME.LAKE]: [0, 0.3],
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Layout ────────────────────────────────────────────────────────────────────

/**
 * Places the locations relative to (0, 0). Returns the described locations with
 * x, y, parent (index or -1) and the settlement links that become roads.
 */
export function layoutLocations(locations, seed = 1) {
  const rng = mulberry(seed * 7919 + 13);
  const all = locations.map(describeLocation).filter(l => l.include);
  const byName = new Map(all.map((l, i) => [l.name.toLowerCase(), i]));
  const mentions = (l) => {
    const out = [];
    const add = (i) => { if (i != null && i !== l.idx && !out.includes(i)) out.push(i); };
    if (l.near) add(byName.get(l.near));
    // names in the region field first, then linked or named in the text
    for (const [name, i] of byName) if (name.length > 2 && l.region.includes(name)) add(i);
    for (const n of l.links) add(byName.get(n));
    for (const [name, i] of byName) if (name.length > 3 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(l.text)) add(i);
    return out;
  };
  all.forEach((l, i) => { l.idx = i; });
  all.forEach(l => { l.mentions = mentions(l); });

  // Settlements stand on their own unless told otherwise; everything else
  // hangs off the first place it mentions (a lake centres on the dungeon or
  // landmark it surrounds).
  for (const l of all) {
    l.parent = -1;
    if (l.settlement && !l.near) continue;
    let cand = l.mentions;
    if (l.isLake) {
      const site = cand.find(i => !all[i].settlement && !all[i].isLake);
      if (site != null) { l.parent = site; l.dist = 0; continue; }
    }
    if (!l.near) cand = [...cand.filter(i => all[i].settlement), ...cand.filter(i => !all[i].settlement)];
    l.parent = cand[0] ?? -1;
  }
  // break loops (a → b → a): the later one lets go
  for (const l of all) {
    const seen = new Set([l.idx]);
    let p = l.parent;
    while (p >= 0) {
      if (seen.has(p)) { l.parent = -1; break; }
      seen.add(p);
      p = all[p].parent;
    }
  }

  // Roots: start at their terrain's zone, then push apart.
  const roots = all.filter(l => l.parent < 0);
  const span = 2600 * Math.sqrt(Math.max(1, roots.length) / 6);
  for (const l of roots) {
    const z = ZONE[l.terrain] || [0, 0];
    l.x = z[0] * span + (rng() - 0.5) * span * 0.5;
    l.y = z[1] * span * 0.7 + (rng() - 0.5) * span * 0.4;
  }
  const minGap = 1500;
  for (let it = 0; it < 300; it++) {
    for (let a = 0; a < roots.length; a++) {
      for (let b = a + 1; b < roots.length; b++) {
        const A = roots[a], B = roots[b];
        let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
        if (d < 1e-3) { dx = rng() - 0.5; dy = rng() - 0.5; d = Math.hypot(dx, dy); }
        if (d < minGap) {
          const push = (minGap - d) / 2 / d;
          A.x -= dx * push; A.y -= dy * push; B.x += dx * push; B.y += dy * push;
        }
      }
    }
    // a gentle pull to the middle keeps the continent together
    for (const l of roots) { l.x *= 0.995; l.y *= 0.995; }
  }
  // coastal roots move out to the rim
  const rim = Math.max(span * 0.9, ...roots.map(l => Math.hypot(l.x, l.y))) + 300;
  for (const l of roots) {
    if (!l.coastal) continue;
    const d = Math.hypot(l.x, l.y) || 1;
    l.x = (l.x / d) * rim; l.y = (l.y / d) * rim;
  }

  // Children, nearest first, spread around their parent.
  const placed = new Set(roots.map(l => l.idx));
  const order = all.filter(l => l.parent >= 0);
  for (let guard = 0; order.length && guard < 1000; guard++) {
    const l = order.shift();
    if (!placed.has(l.parent)) { order.push(l); continue; }
    const p = all[l.parent];
    const siblings = all.filter(s => s.parent === l.parent && placed.has(s.idx)).length;
    let dir = l.direction;
    const said = l.text.match(DIR_WORDS);
    if (!dir && said) dir = DIRS[said[1].replace(/^(north|south)(east|west)$/, '$1-$2')];
    if (!dir) {
      // toward its own terrain's zone, else away from the middle
      const z = ZONE[l.terrain];
      dir = z && (z[0] || z[1]) && l.terrain !== p.terrain ? z : [p.x || rng() - 0.5, p.y || rng() - 0.5];
      const a = Math.atan2(dir[1], dir[0]) + siblings * 1.9;
      dir = [Math.cos(a), Math.sin(a)];
    }
    const n = Math.hypot(dir[0], dir[1]) || 1;
    const dist = l.dist ?? l.distance ?? distanceFromText(l.text);
    l.x = p.x + (dir[0] / n) * dist;
    l.y = p.y + (dir[1] / n) * dist;
    placed.add(l.idx);
  }

  // Roads: a minimum spanning tree over the settlements, plus any asked for.
  const towns = all.filter(l => l.settlement);
  const roads = [];
  const inTree = new Set(towns.length ? [towns[0].idx] : []);
  while (inTree.size < towns.length) {
    let best = null;
    for (const a of towns) {
      if (!inTree.has(a.idx)) continue;
      for (const b of towns) {
        if (inTree.has(b.idx)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!best || d < best.d) best = { a: a.idx, b: b.idx, d };
      }
    }
    roads.push([best.a, best.b]);
    inTree.add(best.b);
  }
  for (const l of all) {
    for (const n of l.roads) {
      const j = byName.get(n);
      if (j != null && !roads.some(([a, b]) => (a === l.idx && b === j) || (a === j && b === l.idx))) roads.push([l.idx, j]);
    }
  }
  return { places: all, roads };
}

// ── Terrain and lines ────────────────────────────────────────────────────────

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function wander(points, amp, step, seed) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay) || 1, n = Math.max(1, Math.round(len / step));
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const off = k === n ? 0 : (valueNoise((i * 7 + t) * 3.1, seed, seed) - 0.5) * 2 * amp * Math.sin(Math.PI * t);
      out.push([ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off]);
    }
  }
  return simplifyPoints(out, 3).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}

/**
 * Paints a map from the locations around world point (cx, cy), replacing
 * everything in the area it covers. Returns { dirty, rect, paths, places, layout }.
 * `newId` makes ids for the new lines and places.
 */
export function generateFromLocations(terrain, cx, cy, locations, { seed = 1, newId }) {
  const { places: locs, roads } = layoutLocations(locations, seed);
  if (!locs.length) return { dirty: new Set(), paths: [], places: [], layout: [] };
  const P = locs.map(l => ({ ...l, x: l.x + cx, y: l.y + cy }));

  // Land: discs around every place and along every road, warped by noise;
  // coastal places get small discs so the sea reaches them.
  const land = [];
  for (const l of P) land.push({ ax: l.x, ay: l.y, bx: l.x, by: l.y, r: l.coastal ? 420 : l.parent >= 0 ? 750 : 1350 });
  for (const [a, b] of roads) land.push({ ax: P[a].x, ay: P[a].y, bx: P[b].x, by: P[b].y, r: 700 });
  const xs = P.map(l => l.x), ys = P.map(l => l.y);
  const pad = 2200;
  const rect = { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, maxX: Math.max(...xs) + pad, maxY: Math.max(...ys) + pad };
  const mid = [(rect.minX + rect.maxX) / 2, (rect.minY + rect.maxY) / 2];

  // Terrain regions, first match wins.
  const regions = [];
  const disc = (x, y, r, biome, warp = 1) => regions.push({ ax: x, ay: y, bx: x, by: y, r, biome, warp });
  const coves = [];
  for (const l of P) {
    if (!l.coastal) continue;
    const d = Math.hypot(l.x - mid[0], l.y - mid[1]) || 1, ux = (l.x - mid[0]) / d, uy = (l.y - mid[1]) / d;
    coves.push({ ax: l.x + ux * 150, ay: l.y + uy * 150, bx: l.x + ux * 900, by: l.y + uy * 900, r: 170 });
  }
  // something sitting in a lake gets an island
  for (const l of P) if (!l.isLake && P.some(k => k.isLake && Math.hypot(k.x - l.x, k.y - l.y) < 120)) disc(l.x, l.y, 60, BIOME.SWAMP, 0.15);
  for (const l of P) {
    if (l.marker === 'capital' || l.marker === 'city') disc(l.x, l.y, 220, BIOME.CITY, 0.35);
    else if (l.marker === 'town' || l.marker === 'port') disc(l.x, l.y, 130, BIOME.TOWN, 0.35);
    else if (l.marker === 'village' || l.marker === 'farm') disc(l.x, l.y, 90, BIOME.TOWN, 0.35);
  }
  for (const l of P) if (l.isLake) disc(l.x, l.y, 300, BIOME.LAKE, 0.5);
  // children first, so the ground right around them follows their entry
  const ordered = [...P.filter(l => l.parent >= 0), ...P.filter(l => l.parent < 0)];
  for (const l of ordered) {
    if (l.isLake) continue;
    const big = l.parent < 0 ? 1000 : 600;
    disc(l.x, l.y, l.settlement && l.terrain === BIOME.GRASS ? big * 0.7 : big, l.terrain);
  }
  for (const l of P) {
    if (l.secondary == null) continue;
    const a = valueNoise(l.x / 97, l.y / 97, seed) * Math.PI * 2;
    for (const k of [0, 2.3]) disc(l.x + Math.cos(a + k) * 900, l.y + Math.sin(a + k) * 900, 420, l.secondary);
  }
  const fields = P.filter(l => l.marker === 'city' || l.marker === 'capital' || l.marker === 'town');
  for (const l of fields) disc(l.x + 150, l.y + 180, 380, BIOME.FARMLAND, 0.8);

  const S = seed * 31 + 5;
  const biomeAt = (gx, gy) => {
    const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL;
    const n1 = fbm(x / 1500, y / 1500, S, 4) - 0.5, n2 = fbm(x / 1500, y / 1500, S + 1, 4) - 0.5;
    const d1 = fbm(x / 420, y / 420, S + 2, 3) - 0.5, d2 = fbm(x / 420, y / 420, S + 3, 3) - 0.5;
    // coast
    const lx = x + n1 * 1000 + d1 * 300, ly = y + n2 * 1000 + d2 * 300;
    let isLand = false;
    for (const s of land) if (segDist(lx, ly, s.ax, s.ay, s.bx, s.by) < s.r) { isLand = true; break; }
    if (!isLand) return 0;
    for (const c of coves) if (segDist(x + d1 * 120, y + d2 * 120, c.ax, c.ay, c.bx, c.by) < c.r) return 0;
    // terrain
    const wx = n1 + d1 * 0.6, wy = n2 + d2 * 0.6;
    for (const r of regions) {
      const amp = r.r * 1.1 * r.warp;
      if (segDist(x + wx * amp, y + wy * amp, r.ax, r.ay, r.bx, r.by) < r.r) return r.biome;
    }
    // the open country in between: mostly grass with a few woods and hills
    const v = fbm(x / 700, y / 700, S + 9, 3);
    return v > 0.68 ? BIOME.FOREST : v < 0.24 ? BIOME.HILLS : BIOME.GRASS;
  };
  const g = (v) => Math.floor(v / CELL);
  const dirty = terrain.fillRect(g(rect.minX), g(rect.minY), g(rect.maxX), g(rect.maxY), biomeAt);

  // Lines.
  const paths = [];
  let n = 0;
  const line = (kind, width, pts, amp, step) => paths.push({ id: newId(), kind, width, points: wander(pts, amp, step, seed * 13 + n++) });
  for (const [a, b] of roads) line('road', 5, [[P[a].x, P[a].y], [P[b].x, P[b].y]], 60, 120);
  for (const l of P) {
    if (l.parent < 0 || l.isLake) continue;
    const p = P[l.parent];
    if (Math.hypot(l.x - p.x, l.y - p.y) > 200 && !P.some(k => k.isLake && Math.hypot(k.x - l.x, k.y - l.y) < 120)) line('trail', 4, [[p.x, p.y], [l.x, l.y]], 40, 80);
  }
  // Rivers run from high ground and lakes down to the sea.
  const sources = P.filter(l => [BIOME.MOUNTAINS, BIOME.SNOWPEAKS, BIOME.SNOW, BIOME.HILLS, BIOME.PINE, BIOME.MOOR].includes(l.terrain) || l.isLake).slice(0, 6);
  for (const l of sources) {
    const out = [l.x - mid[0], l.y - mid[1]];
    const d = Math.hypot(out[0], out[1]) || 1;
    // set off sideways from the place, then bend toward the nearest open sea
    let ang = Math.atan2(out[1] / d, out[0] / d) + (valueNoise(l.x / 50, l.y / 50, seed) - 0.5) * 1.2;
    let x = l.x + Math.cos(ang + 1.2) * (l.isLake ? 300 : 250), y = l.y + Math.sin(ang + 1.2) * (l.isLake ? 300 : 250);
    const pts = [[x, y]];
    let sea = false;
    for (let i = 0; i < 70 && !sea; i++) {
      ang += (valueNoise(i / 4, l.x / 300, seed + 7) - 0.5) * 0.5;
      x += Math.cos(ang) * 110; y += Math.sin(ang) * 110;
      pts.push([x, y]);
      sea = terrain.at(x, y) === BIOME.OCEAN;
    }
    if (sea && pts.length > 5) paths.push({ id: newId(), kind: 'river', width: 8 + (paths.length % 3) * 2, points: wander(pts, 30, 110, seed + paths.length) });
  }

  const places = P.map(l => ({
    id: newId(), kind: l.marker || 'landmark', x: Math.round(l.x * 10) / 10, y: Math.round(l.y * 10) / 10,
    name: l.name, entityId: l.id, entityType: 'locations', ...(l.marker ? {} : { nameOnly: true }),
  }));
  return {
    dirty, rect, paths, places,
    layout: P.map(l => ({ name: l.name, terrain: BIOMES[l.terrain]?.label, near: l.parent >= 0 ? P[l.parent].name : null, coastal: l.coastal })),
  };
}
