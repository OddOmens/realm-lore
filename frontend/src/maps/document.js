// The map document: everything on a map except its terrain (which lives in
// maps/<id>.terrain). Version 2 is the map builder's format; version 1 maps
// from the old sketch editor are converted when they're opened.

import { v4 as uuidv4 } from 'uuid';

export const DOC_VERSION = 2;

// Layer toggles in the Layers menu. Everything is visible unless hidden[key].
export const LAYERS = [
  { key: 'symbols',   label: 'Terrain symbols' },
  { key: 'rivers',    label: 'Rivers' },
  { key: 'roads',     label: 'Roads & borders' },
  { key: 'places',    label: 'Places' },
  { key: 'labels',    label: 'Labels' },
  { key: 'stamps',    label: 'Stamps' },
  { key: 'pins',      label: 'Pins' },
  { key: 'ink',       label: 'Ink' },
  { key: 'reference', label: 'Reference image' },
  { key: 'grid',      label: 'Grid' },
];

// Keys of the map record that belong to the document.
const DOC_KEYS = ['paths', 'places', 'labels', 'stamps', 'pins', 'protagonist', 'reference', 'hidden'];

export function emptyDoc() {
  return { paths: [], places: [], labels: [], stamps: [], pins: [], protagonist: null, reference: null, hidden: { grid: true } };
}

export function docFromMap(map) {
  if (!map) return emptyDoc();
  if (map.version >= DOC_VERSION) {
    const doc = emptyDoc();
    for (const k of DOC_KEYS) if (map[k] !== undefined && map[k] !== null) doc[k] = map[k];
    if (map.protagonist === null) doc.protagonist = null;
    if (map.reference === null) doc.reference = null;
    return doc;
  }
  return migrateV1(map);
}

/** The fields to write back to the map record. */
export function docToRecord(doc) {
  const out = { version: DOC_VERSION };
  for (const k of DOC_KEYS) out[k] = doc[k] ?? null;
  return out;
}

// ── Version 1 (sketch editor) ─────────────────────────────────────────────────
// v1 stored pins and stamps as fractions of the canvas, strokes in canvas
// pixels, and an optional background image covering the canvas.

const LEGACY_CANVAS = { w: 2000, h: 1500 };
const LARGE_CANVAS = { w: 32768, h: 32768 };

// v1 stamp kinds that are now places, and what they become.
const STAMP_TO_PLACE = {
  capital: 'capital', city: 'city', castle: 'castle', village: 'village', camp: 'camp',
  port: 'port', dungeon: 'dungeon', shrine: 'temple', magic: 'landmark', battle: 'landmark',
  volcano: 'landmark', compass: 'landmark', forest: 'landmark', pines: 'landmark',
  mountain: 'landmark', snowypeak: 'landmark', sea: 'landmark',
};
const STAMP_NAMES = {
  magic: 'Magic site', battle: 'Battle', volcano: 'Volcano', compass: '', forest: 'Forest',
  pines: 'Pine forest', mountain: 'Mountain', snowypeak: 'Snowy peak', sea: 'Sea',
};

function migrateV1(map) {
  const hasSpatial = map.strokes?.length || map.pins?.length || map.stamps?.length || map.protagonist;
  const size = map.canvasSize?.w ? map.canvasSize : (hasSpatial ? LEGACY_CANVAS : LARGE_CANVAS);
  const doc = emptyDoc();

  for (const s of map.strokes || []) {
    if (!Array.isArray(s.points) || s.points.length < 2) continue;
    const kind = s.layerId === 'rivers' ? 'river' : s.layerId === 'roads' ? 'road' : 'ink';
    doc.paths.push({
      id: s.id || uuidv4(),
      kind,
      points: s.points.map(([x, y]) => [x, y]),
      width: kind === 'ink' ? (s.size || 3) : Math.max(4, (s.size || 3) * 2),
      color: kind === 'ink' ? (s.color || '#4a3b2a') : undefined,
    });
  }

  for (const st of map.stamps || []) {
    const x = st.x * size.w, y = st.y * size.h;
    const placeKind = STAMP_TO_PLACE[st.kind];
    if (placeKind) {
      doc.places.push({ id: st.id || uuidv4(), kind: placeKind, x, y, name: STAMP_NAMES[st.kind] ?? '' });
    } else if (st.libraryPath || st.customId) {
      doc.stamps.push({
        id: st.id || uuidv4(),
        src: st.customId ? 'svg' : 'png',
        ref: st.customId || st.libraryPath,
        x, y,
        size: st.size || 48,
        rotation: st.rotation || 0,
        flipX: !!st.flipX,
        flipY: !!st.flipY,
      });
    }
  }

  for (const p of map.pins || []) {
    doc.pins.push({ id: p.id || uuidv4(), entityId: p.entityId, entityType: p.entityType, x: p.x * size.w, y: p.y * size.h });
  }
  if (map.protagonist) {
    doc.protagonist = { entityId: map.protagonist.entityId, x: map.protagonist.x * size.w, y: map.protagonist.y * size.h };
  }

  // A v1 image covered the canvas from the origin; the editor keeps this only
  // if the image file actually loads (blank v1 maps point at a missing file).
  doc.reference = { x: 0, y: 0, w: size.w, h: size.h, opacity: 1, legacy: true };
  return doc;
}
