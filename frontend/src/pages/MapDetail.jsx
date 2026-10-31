import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  ArrowLeft, MousePointer2, Hand, Paintbrush, PaintBucket, Fence, Castle, Type, Stamp as StampIcon, Pin,
  Undo2, Redo2, Sparkles, Download, MoreHorizontal, Layers, Check, ZoomIn, ZoomOut, Maximize,
  Trash2, Image as ImageIcon, Keyboard, X, Star, Dices, Link2, Upload, FlipHorizontal, ChevronUp,
  Map as MapIcon, ExternalLink, Eye, Pencil, Search, Ruler,
} from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { api, assetUrl } from '../lib/api';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Menu, { MenuItem, MenuLabel, MenuSeparator } from '../components/Menu';
import { Terrain, BIOMES, BIOME, CELL, CHUNK_SIZE, chunkKey, isWater } from '../maps/terrain';
import { applyWorldTransform, applyScreenTransform, screenToWorld, zoomAt, fitRect, visibleRect } from '../maps/view';
import { createTerrainRenderer, PAPER } from '../maps/terrainRender';
import {
  PATH_KINDS, PLACE_KINDS, LABEL_STYLES, drawPaths, drawPlaces, drawLabels, drawSelection,
  hitTest, pathBounds, simplifyPoints, smoothPath,
} from '../maps/features';
import { generateLand, GENERATOR_SHAPES, GENERATOR_CLIMATES } from '../maps/generator';
import { createStampImages, drawStamps, hitStamp, sanitizeSvg } from '../maps/stamps';
import { createFeatureTiles } from '../maps/featureTiles';
import { drawDecor, decorSpace, MILES_PER_UNIT } from '../maps/decor';
import { docFromMap, docToRecord, LAYERS } from '../maps/document';
import { TYPE_META, PROTAGONIST_COLOR } from '../maps/entities';
import EntityPicker from '../maps/EntityPicker';
import CustomStampUploadModal from '../maps/CustomStampUploadModal';

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'select', label: 'Select & move', key: 'V', icon: MousePointer2 },
  { id: 'hand',   label: 'Pan',           key: 'H', icon: Hand },
  { id: 'paint',  label: 'Brush',         key: 'B', icon: Paintbrush },
  { id: 'fill',   label: 'Fill area',     key: 'G', icon: PaintBucket },
  { id: 'border', label: 'Borders',       key: 'R', icon: Fence },
  { id: 'place',  label: 'Places',        key: 'P', icon: Castle },
  { id: 'label',  label: 'Labels',        key: 'T', icon: Type },
  { id: 'stamp',  label: 'Stamps',        key: 'S', icon: StampIcon },
  { id: 'pin',    label: 'Pins',          key: 'I', icon: Pin },
];
const TOOL_BY_KEY = Object.fromEntries(TOOLS.map(t => [t.key.toLowerCase(), t.id]));

const BRUSH_MIN = 16, BRUSH_MAX = 2400;
const DEFAULT_OPTS = {
  biome: BIOME.GRASS,
  brush: 180,
  rough: 0.5,
  mask: false,
  brushMode: 'terrain', // or a line kind from BRUSH_LINES
  pathPx: {},
  inkColor: '#4a3b2a',
  placeKind: 'town',
  placeNameOnly: false,
  labelStyle: 'region',
  stamp: null,
  stampSize: 64,
  pinProtagonist: false,
};
const OPTS_KEY = 'mapBuilderTools';

function loadOpts() {
  try { return { ...DEFAULT_OPTS, ...JSON.parse(localStorage.getItem(OPTS_KEY) || '{}') }; }
  catch { return DEFAULT_OPTS; }
}

// Lines the Brush can draw instead of terrain; borders have their own tool.
const BRUSH_LINES = ['river', 'road', 'trail', 'ink'];
// The kind of line a tool draws with these options, or null.
const lineKind = (tool, o) => tool === 'border' ? 'border'
  : tool === 'paint' && BRUSH_LINES.includes(o.brushMode) ? o.brushMode : null;
// The Brush's eraser removes whole lines it passes over.
const isErasing = (tool, o) => tool === 'paint' && o.brushMode === 'erase';
const isPaintingTerrain = (tool, o) => tool === 'paint' && !lineKind(tool, o) && !isErasing(tool, o);
const ERASER_PX = 8; // the eraser's reach on screen (hitTest's tolerance)

// Terrains in palette order (newer ones can slot in beside their kin).
const PALETTE = [...BIOMES].sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));

const INK_COLORS = ['#4a3b2a', '#1f2328', '#b42318', '#2f6f3a', '#1d4e89', '#6b3fa0'];

// New lines and labels are sized for the zoom you draw them at: these are
// their default on-screen sizes in CSS pixels.
const PATH_PX = { river: 5, road: 3, trail: 3, border: 4, ink: 2.5 };
const LABEL_PX = { realm: 28, region: 18, sea: 18, place: 13 };
const pathPx = (o, kind) => o.pathPx?.[kind] ?? PATH_PX[kind] ?? 3;

const PLACE_BY_KIND = Object.fromEntries(PLACE_KINDS.map(k => [k.kind, k]));
const PATH_BY_KIND = Object.fromEntries(PATH_KINDS.map(k => [k.kind, k]));
const LABEL_BY_STYLE = Object.fromEntries(LABEL_STYLES.map(s => [s.style, s]));
const DEFAULT_LABEL_TEXT = { realm: 'Realm', region: 'Region', sea: 'Sea', place: 'Label' };

// Which layer toggle hides each path kind.
const PATH_LAYER = { river: 'rivers', road: 'roads', trail: 'roads', border: 'roads', ink: 'ink' };

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

// Collections in the map document by selection type.
const DOC_KEY = { place: 'places', label: 'labels', path: 'paths', stamp: 'stamps', pin: 'pins' };

// The document with one item moved by (dx, dy) world units.
function translateItem(d, type, id, dx, dy) {
  if (type === 'protagonist') return { ...d, protagonist: d.protagonist ? { ...d.protagonist, x: d.protagonist.x + dx, y: d.protagonist.y + dy } : null };
  const key = DOC_KEY[type];
  if (!key) return d;
  return {
    ...d,
    [key]: d[key].map(x => x.id !== id ? x
      : type === 'path' ? { ...x, points: x.points.map(([px, py]) => [px + dx, py + dy]) }
      : { ...x, x: x.x + dx, y: x.y + dy }),
  };
}

function biomeColor(id) {
  return PAPER.biome?.[id] || '#d8cfa8';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => { resolve(input.files?.[0] || null); input.remove(); });
    input.addEventListener('cancel', () => { resolve(null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

// Brush sizes are chosen on a log scale so both small details and whole
// continents are easy to hit with one slider.
const brushToSlider = (r) => Math.round(100 * Math.log(r / BRUSH_MIN) / Math.log(BRUSH_MAX / BRUSH_MIN));
const sliderToBrush = (v) => Math.round(BRUSH_MIN * Math.pow(BRUSH_MAX / BRUSH_MIN, v / 100));

// ── Small UI pieces ───────────────────────────────────────────────────────────

function ToolButton({ tool, active, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${tool.label} (${tool.key})`}
      aria-label={tool.label}
      aria-pressed={active}
      className={`grid size-9 shrink-0 place-items-center rounded-md transition-colors ${
        active ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon size={18} />
    </button>
  );
}

function Panel({ title, onClose, children, className = '' }) {
  return (
    <div className={`rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
          <p className="flex-1 truncate text-xs font-medium text-muted-foreground">{title}</p>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <div className="px-3 pb-3 pt-1">{children}</div>
    </div>
  );
}

function Field({ label, value, children }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        {value !== undefined && <span className="tabular-nums text-muted-foreground">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// onStart/onEnd bracket one drag, so the editor can record it as a single undo step.
function Slider({ value, min, max, step = 1, onChange, onStart, onEnd }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      onPointerDown={onStart}
      onPointerUp={onEnd}
      onFocus={onStart}
      onBlur={onEnd}
      className="w-full accent-[hsl(var(--brand))]"
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-input'}`}
      >
        <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}

// Draws a place glyph into a small canvas for the picker.
function PlaceGlyph({ kind, size = 32 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    const def = PLACE_BY_KIND[kind];
    const zoom = (size * 0.8) / ((def?.size || 24) * 1.4);
    const view = { x: -size / 2 / zoom, y: -size / 2 / zoom, zoom, dpr, width: size, height: size };
    applyWorldTransform(ctx, view);
    try { drawPlaces(ctx, [{ id: 'preview', kind, x: 0, y: 0, name: '' }], view, { preview: true }); } catch { /* glyph preview only */ }
  }, [kind, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

function PinMarker({ color, Icon, protagonist }) {
  const size = protagonist ? 34 : 28;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
      <path d="M16 1 C 8 1 3 7 3 14 C 3 22 16 31 16 31 C 16 31 29 22 29 14 C 29 7 24 1 16 1 Z" fill={color} stroke="white" strokeWidth={1.5} />
      <circle cx={16} cy={13} r={6.5} fill="white" />
      <foreignObject x={9} y={6} width={14} height={14}>
        <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={11} color={color} strokeWidth={2.5} />
        </div>
      </foreignObject>
    </svg>
  );
}

// ── Generate land dialog ──────────────────────────────────────────────────────

function GenerateModal({ onGenerate, onClose, firstTime }) {
  const [shape, setShape] = useState('continent');
  const [climate, setClimate] = useState('varied');
  const [rivers, setRivers] = useState(true);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    // Let the button show its busy state before the generator blocks the thread.
    setTimeout(() => onGenerate({ shape, climate, rivers, seed }), 30);
  };

  return (
    <Modal title={firstTime ? 'Start with some land' : 'Generate land'} onClose={onClose} size="md">
      <p className="text-sm text-muted-foreground">
        Make a landmass in the middle of the view, then paint over it to make it yours. Rivers, roads and trails already in that area are replaced. You can undo it.
      </p>
      <Field label="Shape">
        <div className="tabs w-full">
          {GENERATOR_SHAPES.map(s => (
            <button key={s.value} type="button" onClick={() => setShape(s.value)} className={`tab flex-1 ${shape === s.value ? 'is-active' : ''}`}>{s.label}</button>
          ))}
        </div>
      </Field>
      <Field label="Climate">
        <div className="flex flex-wrap gap-1">
          {GENERATOR_CLIMATES.map(c => (
            <button key={c.value} type="button" onClick={() => setClimate(c.value)} className={`btn btn-sm ${climate === c.value ? 'btn-primary' : 'btn-outline'}`}>{c.label}</button>
          ))}
        </div>
      </Field>
      <Toggle checked={rivers} onChange={setRivers} label="Add rivers" />
      <Field label="Seed">
        <div className="flex gap-2">
          <input className="input" inputMode="numeric" value={seed} onChange={e => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)} />
          <button type="button" className="btn btn-outline btn-icon" title="Random seed" aria-label="Random seed" onClick={() => setSeed(Math.floor(Math.random() * 1e6))}>
            <Dices />
          </button>
        </div>
      </Field>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>{firstTime ? 'Start blank' : 'Cancel'}</button>
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
          <Sparkles /> {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </Modal>
  );
}

function ShortcutsModal({ onClose }) {
  const rows = [
    ...TOOLS.map(t => [t.key, t.label]),
    ['E', 'Switch between View and Edit'],
    ['M', 'Measure distance'],
    ['/', 'Find a place (View mode)'],
    ['Space + drag', 'Pan with any tool'],
    ['Scroll / pinch', 'Zoom'],
    ['[ and ]', 'Brush or line smaller / bigger'],
    ['Shift+click', 'Paint a straight line from the last stroke'],
    ['Alt+click', 'Pick up the terrain under the cursor'],
    ['Ctrl+D', 'Duplicate the selection'],
    ['Arrow keys', 'Nudge the selection (Shift: further)'],
    ['0', 'Fit the map'],
    ['Delete', 'Remove the selection'],
    ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'],
    ['Esc', 'Deselect'],
  ];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} size="sm">
      <div className="divide-y divide-border rounded-lg border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
            <span>{v}</span>
            <kbd className="kbd">{k}</kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const map = useWorldStore(s => s.maps.find(m => m.id === id));
  const isLoading = useWorldStore(s => s.isLoading);

  if (!map) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <MapIcon size={32} className="mb-3 text-muted-foreground/50" />
        <p className="mb-4 text-sm text-muted-foreground">{isLoading ? 'Loading…' : 'Map not found.'}</p>
        {!isLoading && <button onClick={() => navigate('/maps')} className="btn btn-outline">Back to maps</button>}
      </div>
    );
  }
  return <MapEditor key={map.id} map={map} />;
}

function MapEditor({ map }) {
  const navigate = useNavigate();
  const activeWorld       = useWorldStore(s => s.activeWorld);
  const updateMapMeta     = useWorldStore(s => s.updateMapMeta);
  const deleteMap         = useWorldStore(s => s.deleteMap);
  const customStamps      = useWorldStore(s => s.customStamps);
  const addCustomStamp    = useWorldStore(s => s.addCustomStamp);
  const deleteCustomStamp = useWorldStore(s => s.deleteCustomStamp);
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);

  const lookupEntity = useCallback((type, entityId) => {
    const arr = { characters, locations, things, lore, factions, creatures }[type] || [];
    return arr.find(e => e.id === entityId) || null;
  }, [characters, locations, things, lore, factions, creatures]);

  // ── Document, terrain, renderer ─────────────────────────────────────────────
  const [doc, setDocState] = useState(() => docFromMap(map));
  const docRef = useRef(doc);
  const terrainRef = useRef(null);
  const rendererRef = useRef(null);
  const [terrainReady, setTerrainReady] = useState(false);
  const [terrainError, setTerrainError] = useState('');

  const [tool, setToolState] = useState('select');
  const toolRef = useRef(tool);
  const [opts, setOptsState] = useState(loadOpts);
  const optsRef = useRef(opts);
  const [selection, setSelectionState] = useState(null); // { type, id }
  const selectionRef = useRef(null);

  const [saveState, setSaveState] = useState('saved');
  // View mode is for reading the map: no tools, and everything over the
  // terrain comes from cached tiles so panning is just copying bitmaps.
  // Maps that already have content open in View mode.
  const [mode, setModeState] = useState(() => (map.thumbAt && !map.autoGenerate ? 'view' : 'edit'));
  const modeRef = useRef(mode);
  const [viewCard, setViewCard] = useState(null); // { kind: 'place'|'pin'|'protagonist', id, sx, sy }
  const viewCardRef = useRef(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const zoomLabelRef = useRef(null);
  const [initialZoomText] = useState('');
  // The inspector shows sizes in screen pixels, so it needs the zoom, but only
  // while something is selected (it doesn't re-render while just panning).
  const [inspectZoom, setInspectZoom] = useState(1);
  const tilesRef = useRef(null);
  const flyRef = useRef(0);
  // Ruler: drag to measure; the line stays until the next measurement.
  const [measuring, setMeasuringState] = useState(false);
  const measuringRef = useRef(false);
  const measureRef = useRef(null); // { a: [x, y], b: [x, y] } in world units
  const [toast, setToast] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [picker, setPicker] = useState(null); // { x, y, protagonist } | { linkPlace: id }
  const [showGenerate, setShowGenerate] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(map.name || '');
  const [pendingUpload, setPendingUpload] = useState(null);
  const [stampLibrary, setStampLibrary] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isPhone, setIsPhone] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const viewRef = useRef({ x: -800, y: -500, zoom: 0.25, width: 800, height: 600, dpr: window.devicePixelRatio || 1 });
  const frameRef = useRef(0);
  const gestureRef = useRef(null);
  const pointersRef = useRef(new Map());
  const cursorRef = useRef(null); // world point under the mouse, for the brush outline
  const lastPaintRef = useRef(null); // where the last brush stroke ended, for Shift-click lines
  const shiftRef = useRef(false);
  const previewRef = useRef(null); // path being drawn
  const spaceRef = useRef(false);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const dirtyRef = useRef({ doc: false, terrain: false });
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const refImageRef = useRef(null);
  const stampImagesRef = useRef(null);
  const toastTimerRef = useRef(null);
  const nameInputRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 3200);
  }, []);

  // ── Drawing ─────────────────────────────────────────────────────────────────

  // Frames always go through drawRef so a frame scheduled before the latest
  // draw() exists still runs the current one.
  // The ruler line with its distance, kept a fixed size on screen.
  const drawMeasure = (ctx, view) => {
    const m = measureRef.current;
    if (!m) return;
    const [ax, ay] = m.a, [bx, by] = m.b;
    const miles = Math.hypot(bx - ax, by - ay) * MILES_PER_UNIT;
    const z = view.zoom;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 5 / z;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#3b5bdb';
    ctx.lineWidth = 2 / z;
    ctx.setLineDash([7 / z, 5 / z]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3b5bdb';
    for (const [x, y] of [m.a, m.b]) { ctx.beginPath(); ctx.arc(x, y, 4 / z, 0, Math.PI * 2); ctx.fill(); }
    // About 20 miles a day on foot, 40 on horseback, as most tabletop games reckon it.
    const dist = miles >= 10 ? Math.round(miles).toLocaleString() : miles.toFixed(1);
    const days = miles / 20;
    const text = `${dist} mi · ${days < 1 ? `${Math.max(1, Math.round(days * 8))} h` : `${days.toFixed(days < 10 ? 1 : 0)} days`} on foot`;
    const fs = 13 / z;
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const lx = bx + 10 / z, ly = by - 10 / z;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(lx - 6 / z, ly - fs, tw + 12 / z, fs * 1.6, 5 / z);
    ctx.fill();
    ctx.fillStyle = '#1f2328';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, lx, ly - fs * 0.2);
    ctx.restore();
  };

  // Pins are DOM elements; move their layer with the camera.
  const moveOverlay = (view) => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.style.transform = `translate(${-view.x * view.zoom}px, ${-view.y * view.zoom}px)`;
      overlay.style.setProperty('--z', String(view.zoom));
    }
  };

  const drawRef = useRef(() => {});
  const runFrame = useCallback(() => { frameRef.current = 0; drawRef.current(); }, []);
  const draw = useCallback(() => {
    frameRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const view = viewRef.current;
    const d = docRef.current;
    const hidden = d.hidden || {};
    const sel = selectionRef.current;

    applyScreenTransform(ctx, view);
    ctx.fillStyle = PAPER.sea;
    ctx.fillRect(0, 0, view.width, view.height);
    applyWorldTransform(ctx, view);

    let done = true;
    if (rendererRef.current && terrainReady) {
      done = rendererRef.current.draw(ctx, view, { symbols: !hidden.symbols });
    }

    if (modeRef.current === 'view') {
      // Everything over the terrain comes from cached tiles.
      if (tilesRef.current) done = tilesRef.current.draw(ctx, view) && done;
      drawMeasure(ctx, view);
      moveOverlay(view);
      if (!done) frameRef.current = requestAnimationFrame(runFrame);
      return;
    }

    const ref = d.reference;
    if (ref && !hidden.reference && refImageRef.current) {
      ctx.save();
      ctx.globalAlpha = ref.opacity ?? 0.6;
      ctx.drawImage(refImageRef.current, ref.x, ref.y, ref.w, ref.h);
      ctx.restore();
    }

    if (!hidden.grid) drawGrid(ctx, view);

    const paths = d.paths.filter(p => !hidden[PATH_LAYER[p.kind] || 'ink']);
    drawPaths(ctx, previewRef.current ? [...paths, previewRef.current] : paths, view, { selectedId: sel?.type === 'path' ? sel.id : null, terrain: terrainRef.current });
    if (!hidden.stamps && stampImagesRef.current) drawStamps(ctx, d.stamps, stampImagesRef.current, view, { selectedId: sel?.type === 'stamp' ? sel.id : null });
    if (!hidden.places) drawPlaces(ctx, d.places, view, { selectedId: sel?.type === 'place' ? sel.id : null });
    if (!hidden.labels) drawLabels(ctx, d.labels, view, { selectedId: sel?.type === 'label' ? sel.id : null });

    if (sel && (sel.type === 'place' || sel.type === 'label' || sel.type === 'path')) {
      const item = (sel.type === 'place' ? d.places : sel.type === 'label' ? d.labels : d.paths).find(x => x.id === sel.id);
      if (item) drawSelection(ctx, item, sel.type, view);
    }

    // Brush outline
    const t = toolRef.current;
    const erasing = isErasing(t, optsRef.current);
    if ((erasing || isPaintingTerrain(t, optsRef.current)) && cursorRef.current) {
      const [cx, cy] = cursorRef.current;
      ctx.save();
      ctx.lineWidth = 1.5 / view.zoom;
      ctx.strokeStyle = 'rgba(30,25,20,0.7)';
      ctx.setLineDash([5 / view.zoom, 4 / view.zoom]);
      ctx.beginPath();
      ctx.arc(cx, cy, erasing ? ERASER_PX / view.zoom : optsRef.current.brush, 0, Math.PI * 2);
      // Shift held: where a Shift-click would draw its straight line
      const from = lastPaintRef.current;
      if (!erasing && shiftRef.current && from && !gestureRef.current) {
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawMeasure(ctx, view);
    moveOverlay(view);

    if (!done) frameRef.current = requestAnimationFrame(runFrame);
  }, [terrainReady, runFrame]);

  useLayoutEffect(() => { drawRef.current = draw; }, [draw]);

  const requestDraw = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  useEffect(() => { requestDraw(); }, [doc, selection, tool, mode, requestDraw]);
  useEffect(() => () => { cancelAnimationFrame(frameRef.current); frameRef.current = 0; }, []);

  // Called every frame while panning, so it touches no React state: the zoom
  // readout is updated directly and an open place card simply closes.
  const setView = useCallback((next) => {
    viewRef.current = next;
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(next.zoom * 100)}%`;
    if (viewCardRef.current) { viewCardRef.current = null; setViewCard(null); }
    if (selectionRef.current) setInspectZoom(z => (Math.abs(z - next.zoom) / z > 0.02 ? next.zoom : z));
    requestDraw();
  }, [requestDraw]);

  const setMeasuring = useCallback((on) => {
    measuringRef.current = on;
    setMeasuringState(on);
    if (!on) measureRef.current = null;
    requestDraw();
  }, [requestDraw]);

  const showCard = useCallback((card) => {
    viewCardRef.current = card;
    setViewCard(card);
  }, []);

  // ── State helpers ───────────────────────────────────────────────────────────

  const setTool = useCallback((t) => {
    toolRef.current = t;
    setToolState(t);
    previewRef.current = null;
    if (t !== 'select') { selectionRef.current = null; setSelectionState(null); }
    setOptionsOpen(true);
  }, []);

  const setOpts = useCallback((patch) => {
    setOptsState(prev => {
      const next = { ...prev, ...patch };
      optsRef.current = next;
      try { localStorage.setItem(OPTS_KEY, JSON.stringify({ ...next, stamp: next.stamp })); } catch { /* per-device convenience only */ }
      return next;
    });
    requestDraw();
  }, [requestDraw]);

  const setMode = useCallback((m) => {
    if (m === modeRef.current) return;
    modeRef.current = m;
    setModeState(m);
    gestureRef.current = null;
    previewRef.current = null;
    selectionRef.current = null;
    setSelectionState(null);
    viewCardRef.current = null;
    setViewCard(null);
    setFindOpen(false);
    if (m === 'view') { toolRef.current = 'select'; setToolState('select'); tilesRef.current?.invalidate(); }
    requestDraw();
  }, [requestDraw]);

  const select = useCallback((sel) => {
    if (sel) setInspectZoom(viewRef.current.zoom);
    selectionRef.current = sel;
    setSelectionState(sel);
  }, []);

  const syncHistoryButtons = () => {
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  };

  // ── Saving ──────────────────────────────────────────────────────────────────

  const contentBounds = useCallback(({ withReference = false } = {}) => {
    const d = docRef.current;
    let r = terrainRef.current?.bounds() || null;
    const grow = (minX, minY, maxX, maxY) => {
      if (!r) r = { minX, minY, maxX, maxY };
      else r = { minX: Math.min(r.minX, minX), minY: Math.min(r.minY, minY), maxX: Math.max(r.maxX, maxX), maxY: Math.max(r.maxY, maxY) };
    };
    for (const p of d.paths) { const b = pathBounds(p.points); grow(b.minX, b.minY, b.maxX, b.maxY); }
    for (const p of [...d.places, ...d.labels, ...d.stamps, ...d.pins]) grow(p.x - 40, p.y - 40, p.x + 40, p.y + 40);
    if (withReference && d.reference && !d.reference.legacy) grow(d.reference.x, d.reference.y, d.reference.x + d.reference.w, d.reference.y + d.reference.h);
    return r;
  }, []);

  // Renders the finished map (no pins, grid or reference image) for export
  // and the thumbnail on the Maps page.
  // With decor (PNG export), the rect grows to fit a frame and title band and
  // the frame, compass rose, scale bar and title are drawn over the map.
  const renderComposite = useCallback((rectIn, scale, { decor = false, title = '', reuse = false } = {}) => {
    let rect = rectIn;
    let space = null;
    if (decor) {
      space = decorSpace((rectIn.maxX - rectIn.minX) * scale, (rectIn.maxY - rectIn.minY) * scale, title);
      const m = space.margin / scale;
      rect = { minX: rectIn.minX - m, minY: rectIn.minY - m - space.titleBand / scale, maxX: rectIn.maxX + m, maxY: rectIn.maxY + m };
    }
    const canvas = rendererRef.current.renderRegion(rect, scale, { symbols: !docRef.current.hidden?.symbols, reuse });
    const ctx = canvas.getContext('2d');
    const d = docRef.current;
    const hidden = d.hidden || {};
    const view = { x: rect.minX, y: rect.minY, zoom: scale, dpr: 1, width: canvas.width, height: canvas.height };
    applyWorldTransform(ctx, view);
    // Icons, names and line weights have minimum on-screen sizes. A big export
    // is viewed shrunk, so size those as if for a screen of proportional size.
    const k = decor ? Math.max(1, Math.max(canvas.width, canvas.height) / 1800) : 1;
    const fview = { ...view, zoom: scale / k };
    drawPaths(ctx, d.paths.filter(p => !hidden[PATH_LAYER[p.kind] || 'ink']), fview, { terrain: terrainRef.current });
    if (!hidden.stamps && stampImagesRef.current) drawStamps(ctx, d.stamps, stampImagesRef.current, fview, {});
    if (!hidden.places) drawPlaces(ctx, d.places, fview, {});
    if (!hidden.labels) drawLabels(ctx, d.labels, fview, {});
    if (decor) {
      const terrain = terrainRef.current;
      drawDecor(ctx, rect, scale, { title, margin: space.margin, titleBand: space.titleBand, landAt: (x, y) => !isWater(terrain.at(x, y)) });
    }
    return canvas;
  }, []);

  const saveRef = useRef(null);
  // The thumbnail is rendered on the main thread (from the bitmaps on screen
  // where it can), so it's refreshed at most every 20 s while editing, and
  // always when leaving the map.
  const thumbStaleRef = useRef(false);
  const lastThumbRef = useRef(0);
  const save = useCallback(async ({ final = false } = {}) => {
    if (savingRef.current) { saveTimerRef.current = setTimeout(() => saveRef.current({ final }), 400); return; }
    const dirty = dirtyRef.current;
    if (dirty.doc || dirty.terrain) thumbStaleRef.current = true;
    // Wait for the workers so the thumbnail can reuse their bitmaps.
    const wantThumb = thumbStaleRef.current && (final || (Date.now() - lastThumbRef.current > 20000 && !rendererRef.current?.busy()));
    if (!dirty.doc && !dirty.terrain && !wantThumb) return;
    savingRef.current = true;
    dirtyRef.current = { doc: false, terrain: false };
    setSaveState('saving');
    try {
      const base = `${activeWorld}/maps/${map.id}`;
      if (dirty.terrain && terrainRef.current) {
        await api.fsWrite(`${base}.terrain`, JSON.stringify(terrainRef.current.toJSON()));
      }
      const meta = { ...docToRecord(docRef.current), strokes: [] };
      const b = contentBounds();
      if (wantThumb && b && rendererRef.current) {
        const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.06 + 40;
        const rect = { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
        const scale = 640 / Math.max(rect.maxX - rect.minX, rect.maxY - rect.minY);
        const thumb = renderComposite(rect, scale, { reuse: true }).toDataURL('image/jpeg', 0.85);
        await api.fsWrite(`${base}.thumb.img`, thumb);
        meta.thumbAt = Date.now();
        thumbStaleRef.current = false;
        lastThumbRef.current = Date.now();
      }
      const v = viewRef.current;
      meta.view = { x: v.x + v.width / v.zoom / 2, y: v.y + v.height / v.zoom / 2, zoom: v.zoom };
      await updateMapMeta(map.id, meta);
      setSaveState(dirtyRef.current.doc || dirtyRef.current.terrain ? 'unsaved' : 'saved');
    } catch (err) {
      dirtyRef.current = { doc: dirtyRef.current.doc || dirty.doc, terrain: dirtyRef.current.terrain || dirty.terrain };
      setSaveState('error');
      showToast(`Couldn't save: ${err.message}`);
    } finally {
      savingRef.current = false;
    }
  }, [activeWorld, map.id, updateMapMeta, contentBounds, renderComposite, showToast]);

  const scheduleSave = useCallback((what) => {
    dirtyRef.current = { ...dirtyRef.current, [what]: true };
    setSaveState('unsaved');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(), 1200);
  }, [save]);

  // Save anything pending when leaving the page.
  useEffect(() => { saveRef.current = save; }, [save]);
  // Leaving: save anything pending (with a fresh thumbnail), then stop the terrain workers.
  useEffect(() => () => {
    clearTimeout(saveTimerRef.current);
    Promise.resolve(saveRef.current({ final: true })).finally(() => rendererRef.current?.dispose?.());
  }, []);
  useEffect(() => {
    const onHide = () => saveRef.current({ final: true });
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  // ── History ─────────────────────────────────────────────────────────────────

  const setDoc = useCallback((next) => {
    docRef.current = next;
    setDocState(next);
  }, []);

  const pushHistory = useCallback((op) => {
    undoRef.current.push(op);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    syncHistoryButtons();
  }, []);

  /** Replaces the document as one undoable step. */
  const commitDoc = useCallback((next, before = docRef.current) => {
    pushHistory({ doc: { before, after: next } });
    setDoc(next);
    scheduleSave('doc');
  }, [pushHistory, setDoc, scheduleSave]);

  const applyOp = useCallback((op, dir) => {
    if (op.terrain) {
      const dirty = terrainRef.current.applySnapshot(dir === 'undo' ? op.terrain.before : op.terrain.after);
      rendererRef.current?.invalidate(dirty);
      scheduleSave('terrain');
    }
    if (op.doc) {
      setDoc(dir === 'undo' ? op.doc.before : op.doc.after);
      scheduleSave('doc');
    }
    select(null);
    requestDraw();
  }, [setDoc, scheduleSave, select, requestDraw]);

  const undo = useCallback(() => {
    const op = undoRef.current.pop();
    if (!op) return;
    applyOp(op, 'undo');
    redoRef.current.push(op);
    syncHistoryButtons();
  }, [applyOp]);

  const redo = useCallback(() => {
    const op = redoRef.current.pop();
    if (!op) return;
    applyOp(op, 'redo');
    undoRef.current.push(op);
    syncHistoryButtons();
  }, [applyOp]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let terrain = new Terrain();
      try {
        const res = await api.fsRead(`${activeWorld}/maps/${map.id}.terrain`);
        if (res?.content) terrain = Terrain.fromJSON(JSON.parse(res.content));
      } catch (err) {
        if (err.status && err.status !== 404) {
          if (!cancelled) setTerrainError("This map's terrain couldn't be loaded. Editing is off so nothing is overwritten.");
          return;
        }
      }
      if (cancelled) return;
      terrainRef.current = terrain;
      // Workers build the terrain; redraw whenever a piece arrives.
      rendererRef.current = createTerrainRenderer(terrain, { onUpdate: () => requestDraw() });
      setTerrainReady(true);
    })();
    return () => { cancelled = true; };
  }, [activeWorld, map.id, requestDraw]);

  // Reference image (also the background of maps made in the old editor).
  const refImagePresent = !!doc.reference;
  useEffect(() => {
    if (!refImagePresent) { refImageRef.current = null; return; }
    const img = new Image();
    img.onload = () => {
      refImageRef.current = img;
      const r = docRef.current.reference;
      if (r?.legacy && (!map.canvasSize?.w)) {
        // Old image maps were sized by the image itself.
        setDoc({ ...docRef.current, reference: { ...r, w: img.naturalWidth, h: img.naturalHeight, legacy: undefined } });
      } else if (r?.legacy) {
        setDoc({ ...docRef.current, reference: { ...r, legacy: undefined } });
      }
      requestDraw();
    };
    img.onerror = () => {
      // Blank maps from the old editor point at an image that doesn't exist.
      if (docRef.current.reference?.legacy) setDoc({ ...docRef.current, reference: null });
    };
    img.src = assetUrl(`asset://${activeWorld}/maps/${map.id}.img`);
  }, [refImagePresent, activeWorld, map.id, map.canvasSize?.w, setDoc, requestDraw]);

  // Stamp images
  useEffect(() => {
    stampImagesRef.current = createStampImages(() => { tilesRef.current?.invalidate(); requestDraw(); });
  }, [requestDraw]);

  // View-mode tiles draw the finished map (no selection, grid or reference image).
  useEffect(() => {
    tilesRef.current = createFeatureTiles((ctx, view) => {
      const d = docRef.current;
      const hidden = d.hidden || {};
      drawPaths(ctx, d.paths.filter(p => !hidden[PATH_LAYER[p.kind] || 'ink']), view, { terrain: terrainRef.current });
      if (!hidden.stamps && stampImagesRef.current) drawStamps(ctx, d.stamps, stampImagesRef.current, view, {});
      if (!hidden.places) drawPlaces(ctx, d.places, view, {});
      if (!hidden.labels) drawLabels(ctx, d.labels, view, {});
    });
  }, []);
  useEffect(() => { tilesRef.current?.invalidate(); }, [doc]);
  useEffect(() => {
    stampImagesRef.current?.setCustomStamps(customStamps);
    requestDraw();
  }, [customStamps, requestDraw]);
  useEffect(() => {
    api.stampsList().then(r => setStampLibrary(r?.stamps || [])).catch(() => setStampLibrary([]));
  }, []);

  // Canvas size
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      let v = { ...viewRef.current, width: r.width, height: r.height, dpr };
      if (first) {
        first = false;
        const saved = map.view;
        if (saved?.zoom) {
          v = { ...v, zoom: saved.zoom, x: saved.x - r.width / saved.zoom / 2, y: saved.y - r.height / saved.zoom / 2 };
        } else {
          v = { ...v, zoom: 0.12, x: -r.width / 0.12 / 2, y: -r.height / 0.12 / 2 };
        }
      }
      setView(v);
    });
    ro.observe(wrap);
    const mq = window.matchMedia('(max-width: 767px)');
    const onMq = () => setIsPhone(mq.matches);
    mq.addEventListener('change', onMq);
    return () => { ro.disconnect(); mq.removeEventListener('change', onMq); };
  }, [map.view, setView]);

  // First open: fit legacy content, or offer to generate land on a new map.
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!terrainReady || fittedRef.current) return;
    fittedRef.current = true;
    if (!map.view) {
      const b = contentBounds({ withReference: true });
      /* eslint-disable react-hooks/set-state-in-effect -- one-time fit or prompt once the terrain loads */
      if (b) setView(fitRect(viewRef.current, b));
      else if (map.autoGenerate) setShowGenerate({ firstTime: true });
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    requestDraw();
  }, [terrainReady, map.view, map.autoGenerate, contentBounds, setView, requestDraw]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const centerWorld = () => {
    const v = viewRef.current;
    return [v.x + v.width / v.zoom / 2, v.y + v.height / v.zoom / 2];
  };

  const fitMap = useCallback(() => {
    const b = contentBounds({ withReference: true });
    if (b) setView(fitRect(viewRef.current, b));
  }, [contentBounds, setView]);

  const zoomBy = useCallback((f) => {
    const v = viewRef.current;
    setView(zoomAt(v, v.width / 2, v.height / 2, f));
  }, [setView]);

  const runGenerate = ({ shape, climate, rivers, seed }) => {
    const terrain = terrainRef.current;
    const [cx, cy] = centerWorld();
    const before = docRef.current;
    terrain.beginEdit();
    let res;
    try {
      res = generateLand(terrain, cx, cy, { shape, climate, rivers, seed });
    } finally {
      const edit = terrain.endEdit();
      // The new land replaces what was there, so rivers, roads and trails
      // running over it go too (borders and ink are kept).
      const changed = new Set(edit ? edit.after.keys() : []);
      const stale = (p) => (p.kind === 'river' || p.kind === 'road' || p.kind === 'trail')
        && p.points.some(([x, y]) => changed.has(chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE))));
      const kept = before.paths.filter(p => !stale(p));
      const added = res?.paths || [], addedPlaces = res?.places || [];
      const after = kept.length !== before.paths.length || added.length || addedPlaces.length
        ? { ...before, paths: [...kept, ...added], places: [...before.places, ...addedPlaces] }
        : before;
      if (edit || after !== before) {
        pushHistory({ terrain: edit || undefined, doc: after !== before ? { before, after } : undefined });
        if (edit) { rendererRef.current.invalidate(edit.after.keys()); scheduleSave('terrain'); }
        if (after !== before) { setDoc(after); scheduleSave('doc'); }
      }
    }
    setShowGenerate(false);
    if (map.autoGenerate) updateMapMeta(map.id, { autoGenerate: false });
    fitMap();
  };

  const deleteSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel) return;
    const d = docRef.current;
    let next;
    if (sel.type === 'protagonist') next = { ...d, protagonist: null };
    else {
      const key = { place: 'places', label: 'labels', path: 'paths', stamp: 'stamps', pin: 'pins' }[sel.type];
      next = { ...d, [key]: d[key].filter(x => x.id !== sel.id) };
    }
    select(null);
    commitDoc(next, d);
  }, [commitDoc, select]);

  // Copies the selected place, label, stamp or path a little down and to the
  // right, and selects the copy. A copied place isn't linked to an entry.
  const duplicateSelection = useCallback(() => {
    const sel = selectionRef.current;
    const key = sel && { place: 'places', label: 'labels', path: 'paths', stamp: 'stamps' }[sel.type];
    if (!key) return;
    const d = docRef.current;
    const item = d[key].find(x => x.id === sel.id);
    if (!item) return;
    const off = 16 / viewRef.current.zoom;
    const copy = { ...item, id: uuidv4() };
    if (sel.type === 'place') { delete copy.entityId; delete copy.entityType; }
    const next = translateItem({ ...d, [key]: [...d[key], copy] }, sel.type, copy.id, off, off);
    commitDoc(next, d);
    select({ type: sel.type, id: copy.id });
  }, [commitDoc, select]);

  // Arrow keys move the selection by a screen pixel (10 with Shift). Holding
  // a key makes one undo step, recorded when it's released.
  const nudgeStartRef = useRef(null);
  const nudgeSelection = useCallback((dx, dy) => {
    const sel = selectionRef.current;
    if (!sel) return false;
    const d = docRef.current;
    const z = viewRef.current.zoom;
    const next = translateItem(d, sel.type, sel.id, dx / z, dy / z);
    if (next === d) return false;
    if (!nudgeStartRef.current) nudgeStartRef.current = d;
    setDoc(next);
    return true;
  }, [setDoc]);
  const endNudge = useCallback(() => {
    const before = nudgeStartRef.current;
    nudgeStartRef.current = null;
    if (before && before !== docRef.current) {
      pushHistory({ doc: { before, after: docRef.current } });
      scheduleSave('doc');
    }
  }, [pushHistory, scheduleSave]);

  const updateSelected = useCallback((patch, { history = true } = {}) => {
    const sel = selectionRef.current;
    if (!sel) return;
    const d = docRef.current;
    const key = { place: 'places', label: 'labels', path: 'paths', stamp: 'stamps', pin: 'pins' }[sel.type];
    if (!key) return;
    const next = { ...d, [key]: d[key].map(x => x.id === sel.id ? { ...x, ...patch } : x) };
    if (history) commitDoc(next, d);
    else { setDoc(next); scheduleSave('doc'); }
  }, [commitDoc, setDoc, scheduleSave]);

  // Fills the inside of a drawn outline with grassland (old sketch maps were
  // outlines; this turns one into real land in one step).
  const outlineToLand = useCallback((path) => {
    const pts = path.points;
    if (!pts || pts.length < 3) return;
    const terrain = terrainRef.current;
    const b = pathBounds(pts);
    // Test against the smoothed curve the user sees, not its control points.
    const curve = smoothPath(pts);
    const probe = document.createElement('canvas').getContext('2d');
    const inside = (x, y) => probe.isPointInPath(curve, x, y);
    terrain.beginEdit();
    const dirty = terrain.fillRect(
      Math.floor(b.minX / CELL), Math.floor(b.minY / CELL), Math.floor(b.maxX / CELL), Math.floor(b.maxY / CELL),
      (gx, gy) => (isWater(terrain.cell(gx, gy)) && inside((gx + 0.5) * CELL, (gy + 0.5) * CELL) ? BIOME.GRASS : -1),
    );
    const edit = terrain.endEdit();
    if (!edit) { showToast('That outline has no inside to fill.'); return; }
    rendererRef.current.invalidate(dirty);
    pushHistory({ terrain: edit });
    scheduleSave('terrain');
    requestDraw();
  }, [pushHistory, scheduleSave, requestDraw, showToast]);

  // Enter or Escape in a name/text field finishes editing it.
  const finishTextField = (e) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault();
    e.currentTarget.blur();
    select(null);
  };

  // Text fields edit live and land in history as one step when they blur.
  const editStartRef = useRef(null);
  const beginTextEdit = () => { if (!editStartRef.current) editStartRef.current = docRef.current; };
  const endTextEdit = () => {
    const before = editStartRef.current;
    editStartRef.current = null;
    if (before && before !== docRef.current) pushHistory({ doc: { before, after: docRef.current } });
  };

  const setHidden = (key, hide) => {
    const d = docRef.current;
    setDoc({ ...d, hidden: { ...(d.hidden || {}), [key]: hide } });
    scheduleSave('doc');
  };

  const exportPng = async () => {
    const b = contentBounds();
    if (!b) { showToast('Paint some land first.'); return; }
    const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.05 + 60;
    const rect = { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
    const scale = Math.min(1.5, 4096 / Math.max(rect.maxX - rect.minX, rect.maxY - rect.minY));
    showToast('Preparing image…');
    await new Promise(r => setTimeout(r, 30));
    const canvas = renderComposite(rect, scale, { decor: true, title: map.name || '' });
    canvas.toBlob(blob => {
      if (!blob) { showToast("Couldn't make the image."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${map.name || 'map'}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setToast('');
    }, 'image/png');
  };

  const addReferenceImage = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { showToast('That image is over 12 MB.'); return; }
    const dataUrl = await readFileAsDataURL(file);
    const img = new Image();
    img.onload = async () => {
      await api.fsWrite(`${activeWorld}/maps/${map.id}.img`, dataUrl);
      const v = viewRef.current;
      const w = v.width / v.zoom * 0.8;
      const h = w * img.naturalHeight / img.naturalWidth;
      const [cx, cy] = centerWorld();
      refImageRef.current = img;
      commitDoc({ ...docRef.current, reference: { x: cx - w / 2, y: cy - h / 2, w, h, opacity: 0.6 } });
    };
    img.src = dataUrl;
  };

  const saveName = async () => {
    const name = draftName.trim();
    setRenaming(false);
    if (name && name !== map.name) await updateMapMeta(map.id, { name });
  };

  // ── Pointer input ───────────────────────────────────────────────────────────

  const toWorld = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    return { sx, sy, w: screenToWorld(viewRef.current, sx, sy) };
  };

  const finishGesture = useCallback((cancel = false) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;
    if (g.kind === 'paint') {
      const edit = terrainRef.current.endEdit();
      if (edit) { pushHistory({ terrain: edit }); scheduleSave('terrain'); }
      // the renderer held the art under the brush until now
      requestDraw();
    } else if (g.kind === 'path') {
      const pts = previewRef.current?.points || [];
      previewRef.current = null;
      const b = pts.length > 1 ? pathBounds(pts) : null;
      const big = b && Math.max(b.maxX - b.minX, b.maxY - b.minY) * viewRef.current.zoom > 6;
      if (!cancel && big) {
        const o = optsRef.current;
        const path = {
          id: uuidv4(),
          kind: g.line,
          points: simplifyPoints(pts, 1.2 / viewRef.current.zoom),
          width: pathPx(o, g.line) / viewRef.current.zoom,
        };
        if (g.line === 'ink') path.color = o.inkColor;
        commitDoc({ ...docRef.current, paths: [...docRef.current.paths, path] });
      }
      requestDraw();
    } else if (g.kind === 'erase') {
      if (docRef.current !== g.startDoc) {
        pushHistory({ doc: { before: g.startDoc, after: docRef.current } });
        scheduleSave('doc');
      }
    } else if (g.kind === 'move') {
      if (g.moved && !cancel) {
        pushHistory({ doc: { before: g.startDoc, after: docRef.current } });
        scheduleSave('doc');
      } else if (cancel) setDoc(g.startDoc);
      if (!g.moved && g.type === 'pin') select({ type: 'pin', id: g.id });
      if (!g.moved && g.type === 'protagonist') select({ type: 'protagonist', id: 'protagonist' });
    }
  }, [pushHistory, scheduleSave, commitDoc, requestDraw, setDoc, select]);

  // Removes every visible line within the eraser's reach of the segment a→b.
  const eraseAlong = useCallback((a, b) => {
    const d = docRef.current, view = viewRef.current, hidden = d.hidden || {};
    let paths = d.paths.filter(p => !hidden[PATH_LAYER[p.kind] || 'ink']);
    const gone = new Set();
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * view.zoom / 4));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n;
      for (let hit = hitTest({ paths }, x, y, view); hit; hit = hitTest({ paths }, x, y, view)) {
        gone.add(hit.id);
        paths = paths.filter(p => p.id !== hit.id);
      }
    }
    if (gone.size) setDoc({ ...d, paths: d.paths.filter(p => !gone.has(p.id)) });
  }, [setDoc]);

  const startMove = useCallback((type, itemId, w, sx, sy) => {
    gestureRef.current = { kind: 'move', type, id: itemId, last: w, startDoc: docRef.current, sx, sy, moved: false };
  }, []);

  const onPointerDown = (e) => {
    if (e.button === 2 || !terrainReady || terrainError) return;
    const wrap = wrapRef.current;
    wrap.setPointerCapture?.(e.pointerId);
    const { sx, sy, w } = toWorld(e);
    pointersRef.current.set(e.pointerId, { sx, sy });

    if (pointersRef.current.size === 2) {
      // Second finger: switch to pinch-zoom, keeping what the first did.
      finishGesture(gestureRef.current?.kind === 'path');
      const [a, b] = [...pointersRef.current.values()];
      gestureRef.current = {
        kind: 'pinch', startView: viewRef.current,
        dist: Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1,
        mid: [(a.sx + b.sx) / 2, (a.sy + b.sy) / 2],
      };
      return;
    }
    if (pointersRef.current.size > 2) return;

    if (measuringRef.current && e.button === 0 && !spaceRef.current) {
      measureRef.current = { a: w, b: w };
      gestureRef.current = { kind: 'measure' };
      requestDraw();
      return;
    }

    if (modeRef.current === 'view') {
      // View mode: drag pans; a click without movement opens what's under it.
      gestureRef.current = { kind: 'pan', startView: viewRef.current, sx, sy, click: true };
      return;
    }

    const t = toolRef.current;
    const o = optsRef.current;
    if (e.button === 1 || spaceRef.current || t === 'hand') {
      gestureRef.current = { kind: 'pan', startView: viewRef.current, sx, sy };
      return;
    }

    const d = docRef.current;
    const view = viewRef.current;
    // On a phone the options sheet covers the map; tuck it away once drawing starts.
    if (isPhone && (t === 'paint' || t === 'border')) setOptionsOpen(false);
    // Alt-click with a terrain tool picks up the terrain under the cursor.
    if ((t === 'paint' || t === 'fill') && e.altKey) {
      setOpts({ biome: terrainRef.current.at(w[0], w[1]), ...(t === 'paint' ? { brushMode: 'terrain' } : {}) });
      return;
    }
    const line = lineKind(t, o);
    switch (line ? 'line' : isErasing(t, o) ? 'erase' : t) {
      case 'select': {
        const hidden = d.hidden || {};
        const hit = hitTest({
          paths: d.paths.filter(p => !hidden[PATH_LAYER[p.kind] || 'ink']),
          places: hidden.places ? [] : d.places,
          labels: hidden.labels ? [] : d.labels,
        }, w[0], w[1], view);
        const stamp = !hit && !hidden.stamps ? hitStamp(d.stamps, w[0], w[1]) : null;
        const found = hit || (stamp ? { type: 'stamp', id: stamp.id } : null);
        if (found) {
          select(found);
          startMove(found.type, found.id, w, sx, sy);
        } else {
          select(null);
          gestureRef.current = { kind: 'pan', startView: view, sx, sy };
        }
        break;
      }
      case 'paint': {
        // Shift-click paints a straight line from where the last stroke ended.
        const from = e.shiftKey && lastPaintRef.current ? lastPaintRef.current : w;
        terrainRef.current.beginEdit();
        const dirty = terrainRef.current.stroke(from[0], from[1], w[0], w[1], o.brush, o.biome, { rough: o.rough, mask: o.mask && !isWater(o.biome) ? 'land' : null });
        rendererRef.current.invalidate(dirty);
        lastPaintRef.current = w;
        gestureRef.current = { kind: 'paint', last: w };
        requestDraw();
        break;
      }
      case 'fill': {
        const terrain = terrainRef.current;
        terrain.beginEdit();
        const res = terrain.fill(w[0], w[1], o.biome);
        const edit = terrain.endEdit();
        if (res?.tooBig) showToast('That area is open sea. Paint a coastline around it first, then fill.');
        else if (edit) {
          rendererRef.current.invalidate(res);
          pushHistory({ terrain: edit });
          scheduleSave('terrain');
          requestDraw();
        }
        break;
      }
      case 'erase': {
        gestureRef.current = { kind: 'erase', last: w, startDoc: d };
        eraseAlong(w, w);
        break;
      }
      case 'line': {
        previewRef.current = {
          id: 'preview', kind: line, points: [w],
          width: pathPx(o, line) / view.zoom,
          color: line === 'ink' ? o.inkColor : undefined,
        };
        gestureRef.current = { kind: 'path', line };
        break;
      }
      case 'place': {
        const place = { id: uuidv4(), kind: o.placeKind, x: w[0], y: w[1], name: '', ...(o.placeNameOnly ? { nameOnly: true } : {}) };
        commitDoc({ ...d, places: [...d.places, place] });
        setToolState('select'); toolRef.current = 'select';
        select({ type: 'place', id: place.id });
        setTimeout(() => nameInputRef.current?.focus(), 50);
        break;
      }
      case 'label': {
        const style = LABEL_BY_STYLE[o.labelStyle] || LABEL_STYLES[0];
        const label = { id: uuidv4(), x: w[0], y: w[1], text: DEFAULT_LABEL_TEXT[style.style] || 'Label', style: style.style, size: (LABEL_PX[style.style] || 18) / view.zoom, angle: 0 };
        commitDoc({ ...d, labels: [...d.labels, label] });
        setToolState('select'); toolRef.current = 'select';
        select({ type: 'label', id: label.id });
        setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 50);
        break;
      }
      case 'stamp': {
        if (!o.stamp) { showToast('Choose a stamp first.'); break; }
        const stamp = { id: uuidv4(), src: o.stamp.src, ref: o.stamp.ref, x: w[0], y: w[1], size: o.stampSize, rotation: 0, flipX: false, flipY: false };
        commitDoc({ ...d, stamps: [...d.stamps, stamp] });
        break;
      }
      case 'pin':
        setPicker({ x: w[0], y: w[1], protagonist: o.pinProtagonist });
        break;
      default:
    }
  };

  const onPointerMove = (e) => {
    if (!wrapRef.current) return;
    const { sx, sy, w } = toWorld(e);
    if (e.pointerType !== 'touch') {
      cursorRef.current = w;
      if (toolRef.current === 'paint') requestDraw();
    }
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { sx, sy });
    const g = gestureRef.current;
    if (!g && modeRef.current === 'view' && e.pointerType === 'mouse' && !measuringRef.current) {
      wrapRef.current.style.cursor = hitPlace(w) ? 'pointer' : 'grab';
    }
    if (!g) return;
    const o = optsRef.current;
    switch (g.kind) {
      case 'measure': {
        if (measureRef.current) { measureRef.current = { ...measureRef.current, b: w }; requestDraw(); }
        break;
      }
      case 'pan': {
        if (Math.hypot(sx - g.sx, sy - g.sy) > 4) g.moved = true;
        if (g.click && !g.moved) break;
        const v = g.startView;
        setView({ ...viewRef.current, x: v.x - (sx - g.sx) / v.zoom, y: v.y - (sy - g.sy) / v.zoom });
        break;
      }
      case 'pinch': {
        const pts = [...pointersRef.current.values()];
        if (pts.length < 2) break;
        const [a, b] = pts;
        const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
        const mid = [(a.sx + b.sx) / 2, (a.sy + b.sy) / 2];
        const v0 = g.startView;
        const [wx, wy] = screenToWorld(v0, g.mid[0], g.mid[1]);
        const zoomed = zoomAt({ ...v0, zoom: v0.zoom }, g.mid[0], g.mid[1], dist / g.dist);
        setView({ ...viewRef.current, zoom: zoomed.zoom, x: wx - mid[0] / zoomed.zoom, y: wy - mid[1] / zoomed.zoom });
        break;
      }
      case 'paint': {
        const dirty = terrainRef.current.stroke(g.last[0], g.last[1], w[0], w[1], o.brush, o.biome, { rough: o.rough, mask: o.mask && !isWater(o.biome) ? 'land' : null });
        g.last = w;
        lastPaintRef.current = w;
        if (dirty.size) { rendererRef.current.invalidate(dirty); requestDraw(); }
        break;
      }
      case 'erase': {
        eraseAlong(g.last, w);
        g.last = w;
        break;
      }
      case 'path': {
        const pts = previewRef.current?.points;
        if (!pts) break;
        const last = pts[pts.length - 1];
        if (Math.hypot(w[0] - last[0], w[1] - last[1]) * viewRef.current.zoom > 3) {
          // A new array each time: features.js caches curves by array identity.
          previewRef.current = { ...previewRef.current, points: [...pts, w] };
          requestDraw();
        }
        break;
      }
      case 'move': {
        if (!g.moved && Math.hypot(sx - g.sx, sy - g.sy) < 4) break;
        g.moved = true;
        const dx = w[0] - g.last[0], dy = w[1] - g.last[1];
        g.last = w;
        setDoc(translateItem(docRef.current, g.type, g.id, dx, dy));
        break;
      }
      default:
    }
  };

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (g?.kind === 'pinch') {
      if (pointersRef.current.size === 0) gestureRef.current = null;
      return;
    }
    if (g?.kind === 'pan' && g.click && !g.moved && pointersRef.current.size === 0 && e.type !== 'pointercancel') {
      const hit = hitPlace(screenToWorld(viewRef.current, g.sx, g.sy));
      showCard(hit ? { kind: 'place', id: hit.id, sx: g.sx, sy: g.sy } : null);
    }
    if (pointersRef.current.size === 0) finishGesture(e.type === 'pointercancel');
  };

  // The place under a world point in View mode, if any.
  const hitPlace = (w) => {
    const d = docRef.current;
    if (d.hidden?.places) return null;
    const hit = hitTest({ paths: [], places: d.places, labels: [] }, w[0], w[1], viewRef.current);
    return hit?.type === 'place' ? hit : null;
  };

  // Smoothly moves the camera to centre (x, y) at `zoom`.
  const flyTo = useCallback((x, y, zoom, then) => {
    cancelAnimationFrame(flyRef.current);
    const v0 = viewRef.current;
    const c0 = [v0.x + v0.width / v0.zoom / 2, v0.y + v0.height / v0.zoom / 2];
    const z0 = Math.log(v0.zoom), z1 = Math.log(zoom);
    const t0 = performance.now(), dur = 450;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const z = Math.exp(z0 + (z1 - z0) * e);
      const cx = c0[0] + (x - c0[0]) * e, cy = c0[1] + (y - c0[1]) * e;
      const v = viewRef.current;
      setView({ ...v, zoom: z, x: cx - v.width / z / 2, y: cy - v.height / z / 2 });
      if (t < 1) flyRef.current = requestAnimationFrame(step);
      else then?.();
    };
    flyRef.current = requestAnimationFrame(step);
  }, [setView]);
  useEffect(() => () => cancelAnimationFrame(flyRef.current), []);

  const onPointerLeave = () => { cursorRef.current = null; if (toolRef.current === 'paint') requestDraw(); };

  // Wheel / trackpad zoom (non-passive so the page doesn't scroll).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015));
      setView(zoomAt(viewRef.current, e.clientX - r.left, e.clientY - r.top, factor));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [setView]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Shift') { shiftRef.current = true; if (toolRef.current === 'paint') requestDraw(); }
      if (isTyping(document.activeElement) || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z' && modeRef.current === 'edit') { e.preventDefault(); endNudge(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 'd' && modeRef.current === 'edit') { e.preventDefault(); duplicateSelection(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === 'e') { setMode(modeRef.current === 'view' ? 'edit' : 'view'); return; }
      if (k === 'm') { setMeasuring(!measuringRef.current); return; }
      if (modeRef.current === 'view') {
        if (k === '/' || k === 'f') { e.preventDefault(); setFindOpen(true); return; }
        if (k === 'escape') { showCard(null); setFindOpen(false); return; }
        if (k === '0') { fitMap(); return; }
        if (k === '=' || k === '+') { zoomBy(1.25); return; }
        if (k === '-') { zoomBy(0.8); return; }
        return;
      }
      if (k === ' ') { spaceRef.current = true; e.preventDefault(); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelection(); return; }
      if (k === 'escape') { select(null); if (toolRef.current !== 'select') setTool('select'); return; }
      const arrow = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
      if (arrow) {
        const step = e.shiftKey ? 10 : 1;
        if (nudgeSelection(arrow[0] * step, arrow[1] * step)) e.preventDefault();
        return;
      }
      if (k === '[' || k === ']') {
        const o = optsRef.current, f = k === ']' ? 1.25 : 1 / 1.25;
        const line = lineKind(toolRef.current, o);
        if (line) setOpts({ pathPx: { ...o.pathPx, [line]: Math.min(24, Math.max(1, Math.round(pathPx(o, line) * f * 2) / 2)) } });
        else setOpts({ brush: Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, Math.round(o.brush * f))) });
        return;
      }
      if (k === '0') { fitMap(); return; }
      if (k === '=' || k === '+') { zoomBy(1.25); return; }
      if (k === '-') { zoomBy(0.8); return; }
      if (TOOL_BY_KEY[k]) setTool(TOOL_BY_KEY[k]);
    };
    const onKeyUp = (e) => {
      if (e.key === ' ') spaceRef.current = false;
      if (e.key === 'Shift') { shiftRef.current = false; if (toolRef.current === 'paint') requestDraw(); }
      if (e.key.startsWith('Arrow')) endNudge();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [undo, redo, deleteSelection, duplicateSelection, nudgeSelection, endNudge, select, setTool, setOpts, fitMap, zoomBy, setMode, showCard, setMeasuring, requestDraw]);

  // ── Pins (DOM, so they can link to entities) ────────────────────────────────

  const onPickEntity = (entity) => {
    const p = picker;
    setPicker(null);
    if (!p) return;
    const d = docRef.current;
    if (p.linkPlace) {
      const next = { ...d, places: d.places.map(pl => pl.id === p.linkPlace ? { ...pl, entityId: entity.id, entityType: entity._type, name: pl.name || entity.name } : pl) };
      commitDoc(next, d);
      return;
    }
    if (p.protagonist) commitDoc({ ...d, protagonist: { entityId: entity.id, x: p.x, y: p.y } }, d);
    else commitDoc({ ...d, pins: [...d.pins, { id: uuidv4(), entityId: entity.id, entityType: entity._type, x: p.x, y: p.y }] }, d);
  };

  const pinDown = (e, type, pinId) => {
    if (modeRef.current === 'view') {
      e.stopPropagation();
      const r = wrapRef.current.getBoundingClientRect();
      showCard({ kind: type === 'protagonist' ? 'protagonist' : 'pin', id: pinId, sx: e.clientX - r.left, sy: e.clientY - r.top });
      return;
    }
    if (toolRef.current !== 'select' && toolRef.current !== 'pin') return;
    e.stopPropagation();
    wrapRef.current.setPointerCapture?.(e.pointerId);
    const { sx, sy, w } = toWorld(e);
    pointersRef.current.set(e.pointerId, { sx, sy });
    startMove(type, pinId, w, sx, sy);
  };

  const pinsHidden = doc.hidden?.pins;

  // ── Selection details ───────────────────────────────────────────────────────

  const selected = useMemo(() => {
    if (!selection) return null;
    if (selection.type === 'protagonist') return doc.protagonist ? { ...doc.protagonist, id: 'protagonist' } : null;
    const key = { place: 'places', label: 'labels', path: 'paths', stamp: 'stamps', pin: 'pins' }[selection.type];
    return doc[key]?.find(x => x.id === selection.id) || null;
  }, [selection, doc]);

  // ── View mode: card and search ──────────────────────────────────────────────

  const cardInfo = useMemo(() => {
    if (!viewCard) return null;
    if (viewCard.kind === 'place') {
      const p = doc.places.find(x => x.id === viewCard.id);
      if (!p) return null;
      const type = p.entityType || 'locations';
      const entity = p.entityId ? lookupEntity(type, p.entityId) : null;
      return { kind: 'place', name: p.name || PLACE_BY_KIND[p.kind]?.label || 'Place', sub: PLACE_BY_KIND[p.kind]?.label || 'Place', entity, entityType: type };
    }
    const pin = viewCard.kind === 'protagonist' ? doc.protagonist : doc.pins.find(x => x.id === viewCard.id);
    if (!pin) return null;
    const type = viewCard.kind === 'protagonist' ? 'characters' : pin.entityType;
    const entity = lookupEntity(type, pin.entityId);
    if (!entity) return null;
    return { kind: 'pin', name: entity.name, sub: viewCard.kind === 'protagonist' ? 'Protagonist' : (TYPE_META[type]?.label || 'Pin'), entity, entityType: type };
  }, [viewCard, doc, lookupEntity]);

  const findResults = useMemo(() => {
    if (!findOpen) return [];
    const q = findQuery.trim().toLowerCase();
    const out = [];
    for (const p of doc.places) if (p.name) out.push({ kind: 'place', id: p.id, name: p.name, sub: PLACE_BY_KIND[p.kind]?.label || 'Place', x: p.x, y: p.y });
    for (const l of doc.labels) if (l.text) out.push({ kind: 'label', id: l.id, name: l.text, sub: LABEL_BY_STYLE[l.style]?.label || 'Label', x: l.x, y: l.y });
    for (const pin of doc.pins) {
      const e = lookupEntity(pin.entityType, pin.entityId);
      if (e) out.push({ kind: 'pin', id: pin.id, name: e.name, sub: TYPE_META[pin.entityType]?.label || 'Pin', x: pin.x, y: pin.y });
    }
    const hits = q ? out.filter(r => r.name.toLowerCase().includes(q)) : out;
    return hits.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
  }, [findOpen, findQuery, doc, lookupEntity]);

  const goToResult = (r) => {
    setFindOpen(false);
    setFindQuery('');
    const v = viewRef.current;
    const zoom = r.kind === 'label' ? Math.max(v.zoom, 0.12) : Math.max(v.zoom, 0.6);
    flyTo(r.x, r.y, zoom, () => {
      if (r.kind === 'label') return;
      const v2 = viewRef.current;
      showCard({ kind: r.kind, id: r.id, sx: v2.width / 2, sy: v2.height / 2 });
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const toolDef = TOOLS.find(t => t.id === tool);
  const cursor = measuring ? 'crosshair' : mode === 'view' || tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : isPaintingTerrain(tool, opts) || isErasing(tool, opts) ? 'none' : 'crosshair';
  const saveLabel = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Not saved' }[saveState];
  const panelLine = lineKind(tool, opts);
  const hasOptions = ['paint', 'fill', 'border', 'place', 'label', 'stamp', 'pin'].includes(tool);

  const optionsPanel = hasOptions && (
    <Panel
      title={toolDef?.label}
      onClose={isPhone ? () => setOptionsOpen(false) : undefined}
      className={isPhone ? '' : 'w-64'}
    >
      {tool === 'paint' && (
        <div className="mb-3 grid grid-cols-3 gap-1">
          {['terrain', ...BRUSH_LINES, 'erase'].map(m => (
            <button key={m} type="button" onClick={() => setOpts({ brushMode: m })} className={`btn btn-sm px-0 text-xs ${(opts.brushMode || 'terrain') === m ? 'btn-primary' : 'btn-outline'}`}>
              {m === 'terrain' ? 'Terrain' : m === 'erase' ? 'Erase' : PATH_BY_KIND[m].label}
            </button>
          ))}
        </div>
      )}

      {tool === 'paint' && isErasing(tool, opts) && (
        <p className="text-xs leading-relaxed text-muted-foreground">Drag over rivers, roads, trails, borders or ink lines to remove them. You can also pick a line with Select and press Delete.</p>
      )}

      {(tool === 'fill' || isPaintingTerrain(tool, opts)) && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {PALETTE.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setOpts({ biome: b.id })}
                title={b.id === BIOME.OCEAN ? 'Ocean (erases land)' : b.label}
                className={`flex flex-col items-center gap-1 rounded-md p-1 text-[0.65rem] leading-tight transition-colors ${opts.biome === b.id ? 'bg-accent ring-2 ring-brand' : 'hover:bg-accent'}`}
              >
                <span className="h-6 w-full rounded border border-foreground/10" style={{ background: biomeColor(b.id) }} />
                <span className="w-full truncate text-center">{b.label}</span>
              </button>
            ))}
          </div>
          {tool === 'paint' && (
            <>
              <Field label="Brush size" value={opts.brush >= 1000 ? `${(opts.brush / 1000).toFixed(1)}k` : opts.brush}>
                <Slider value={brushToSlider(opts.brush)} min={0} max={100} onChange={v => setOpts({ brush: sliderToBrush(v) })} />
              </Field>
              <Field label="Natural edges" value={`${Math.round(opts.rough * 100)}%`}>
                <Slider value={Math.round(opts.rough * 100)} min={0} max={100} onChange={v => setOpts({ rough: v / 100 })} />
              </Field>
              {!isWater(opts.biome) && opts.biome !== BIOME.GRASS && (
                <Toggle checked={opts.mask} onChange={v => setOpts({ mask: v })} label="Only paint over land" />
              )}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {opts.biome === BIOME.CITY || opts.biome === BIOME.TOWN
                  ? <>Paint the city's footprint; cities get streets and a wall. Name it with the Places tool set to "Name only".</>
                  : <>Paint Grassland to make land, Ocean to erase it. <kbd className="kbd">[</kbd> <kbd className="kbd">]</kbd> change the size, Shift-click paints a straight line and Alt-click picks up a terrain.</>}
              </p>
            </>
          )}
          {tool === 'fill' && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Click an area to fill everything connected to it with the chosen terrain. Alt-click picks up a terrain.</p>
          )}
        </>
      )}

      {panelLine && (
        <>
          <Field label="Width on screen" value={`${pathPx(opts, panelLine)} px`}>
            <Slider
              value={pathPx(opts, panelLine)}
              min={1} max={24} step={0.5}
              onChange={v => setOpts({ pathPx: { ...opts.pathPx, [panelLine]: v } })}
            />
          </Field>
          {panelLine === 'ink' && (
            <Field label="Colour">
              <div className="flex gap-1.5">
                {INK_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setOpts({ inkColor: c })} aria-label={c} className={`size-6 rounded-full border border-foreground/15 ${opts.inkColor === c ? 'ring-2 ring-brand ring-offset-1 ring-offset-popover' : ''}`} style={{ background: c }} />
                ))}
              </div>
            </Field>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {{
              river: 'Drag to draw a river. It widens toward the end you finish at, so start at the source. Its banks stop where it meets a lake or the sea.',
              border: 'Drag to draw a realm border. The tint goes on the left side of the direction you draw.',
            }[panelLine] || 'Drag to draw.'} <kbd className="kbd">[</kbd> <kbd className="kbd">]</kbd> change the width.
          </p>
        </>
      )}

      {tool === 'place' && (
        <>
          <div className="grid grid-cols-4 gap-1">
            {PLACE_KINDS.map(k => (
              <button key={k.kind} type="button" onClick={() => setOpts({ placeKind: k.kind })} className={`flex flex-col items-center gap-0.5 rounded-md p-1 text-[0.65rem] transition-colors ${opts.placeKind === k.kind ? 'bg-accent ring-2 ring-brand' : 'hover:bg-accent'}`}>
                <span className="grid size-8 place-items-center rounded bg-[#efe4c8]"><PlaceGlyph kind={k.kind} size={30} /></span>
                <span className="w-full truncate text-center">{k.label}</span>
              </button>
            ))}
          </div>
          <Toggle checked={opts.placeNameOnly} onChange={v => setOpts({ placeNameOnly: v })} label="Name only, no icon" />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Click the map to add one, then name it. Use name only for cities and towns you've painted as terrain.
          </p>
        </>
      )}

      {tool === 'label' && (
        <>
          <div className="flex flex-col gap-1">
            {LABEL_STYLES.map(s => (
              <button key={s.style} type="button" onClick={() => setOpts({ labelStyle: s.style })} className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${opts.labelStyle === s.style ? 'bg-accent' : 'hover:bg-accent'}`}>
                <span style={{ fontFamily: s.font }}>{s.label}</span>
                {opts.labelStyle === s.style && <Check size={14} />}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Click the map to add a label, then type its text.</p>
        </>
      )}

      {tool === 'stamp' && (
        <>
          <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto">
            {stampLibrary.map(s => (
              <button key={s.rel} type="button" title={s.label} onClick={() => setOpts({ stamp: { src: 'png', ref: s.rel, name: s.label } })} className={`grid aspect-square place-items-center rounded-md border border-border p-1 text-[0.6rem] ${opts.stamp?.ref === s.rel ? 'ring-2 ring-brand' : 'hover:bg-accent'}`}>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
            {(customStamps || []).map(s => (
              <div key={s.id} className="group relative">
                <button type="button" title={s.name} onClick={() => setOpts({ stamp: { src: 'svg', ref: s.id, name: s.name } })} className={`grid aspect-square w-full place-items-center rounded-md border border-border p-1 ${opts.stamp?.ref === s.id ? 'ring-2 ring-brand' : 'hover:bg-accent'}`}>
                  <img src={`data:image/svg+xml;utf8,${encodeURIComponent(sanitizeSvg(s.svg))}`} alt={s.name} className="max-h-full max-w-full" draggable={false} />
                </button>
                <button type="button" aria-label={`Delete ${s.name}`} onClick={() => deleteCustomStamp(s.id)} className="absolute -right-1 -top-1 hidden size-5 place-items-center rounded-full bg-popover text-muted-foreground shadow ring-1 ring-foreground/10 hover:text-destructive group-hover:grid">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          {stampLibrary.length === 0 && (customStamps || []).length === 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">No stamps yet. Upload an SVG, or put PNG files in the server's customStamps folder.</p>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm mt-2 w-full"
            onClick={async () => {
              const file = await pickFile('.svg,image/svg+xml');
              if (!file) return;
              const svg = sanitizeSvg(await file.text());
              if (!svg.toLowerCase().includes('<svg')) { showToast("That file isn't an SVG."); return; }
              setPendingUpload({ initialName: file.name.replace(/\.svg$/i, ''), svg });
            }}
          >
            <Upload /> Upload SVG stamp
          </button>
          <Field label="Size" value={opts.stampSize}>
            <Slider value={opts.stampSize} min={16} max={400} onChange={v => setOpts({ stampSize: v })} />
          </Field>
        </>
      )}

      {tool === 'pin' && (
        <>
          <Toggle checked={opts.pinProtagonist} onChange={v => setOpts({ pinProtagonist: v })} label="Protagonist marker" />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Click the map, then choose a character, location or other entry to pin there. {opts.pinProtagonist ? 'The protagonist marker shows where your main character is; there is one per map.' : ''}
          </p>
        </>
      )}
    </Panel>
  );

  const inspector = selected && (
    <Panel
      title={
        selection.type === 'place' ? (PLACE_BY_KIND[selected.kind]?.label || 'Place') :
        selection.type === 'label' ? 'Label' :
        selection.type === 'path' ? (PATH_BY_KIND[selected.kind]?.label || 'Line') :
        selection.type === 'stamp' ? 'Stamp' :
        selection.type === 'protagonist' ? 'Protagonist' : 'Pin'
      }
      onClose={() => select(null)}
      className={isPhone ? '' : 'w-64'}
    >
      {selection.type === 'place' && (
        <>
          <Field label="Name">
            <input ref={nameInputRef} className="input" value={selected.name || ''} placeholder="Unnamed" onFocus={beginTextEdit} onBlur={endTextEdit} onKeyDown={finishTextField} onChange={e => updateSelected({ name: e.target.value }, { history: false })} />
          </Field>
          <Field label="Kind">
            <div className="grid grid-cols-6 gap-1">
              {PLACE_KINDS.map(k => (
                <button key={k.kind} type="button" title={k.label} onClick={() => updateSelected({ kind: k.kind })} className={`grid aspect-square place-items-center rounded bg-[#efe4c8] ${selected.kind === k.kind ? 'ring-2 ring-brand' : 'opacity-80 hover:opacity-100'}`}>
                  <PlaceGlyph kind={k.kind} size={26} />
                </button>
              ))}
            </div>
          </Field>
          <Toggle checked={!!selected.nameOnly} onChange={v => updateSelected({ nameOnly: v || undefined })} label="Name only, no icon" />
          <Field label="Linked entry">
            {selected.entityId && lookupEntity(selected.entityType || 'locations', selected.entityId) ? (
              <div className="flex gap-1.5">
                <button type="button" className="btn btn-outline btn-sm min-w-0 flex-1 justify-start" onClick={() => navigate(`/${selected.entityType || 'locations'}/${selected.entityId}`)}>
                  <ExternalLink /> <span className="truncate">{lookupEntity(selected.entityType || 'locations', selected.entityId).name}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Unlink" onClick={() => updateSelected({ entityId: null, entityType: null })}><X /></button>
              </div>
            ) : (
              <button type="button" className="btn btn-outline btn-sm w-full" onClick={() => setPicker({ linkPlace: selected.id })}>
                <Link2 /> Link to a location…
              </button>
            )}
          </Field>
        </>
      )}

      {selection.type === 'label' && (
        <>
          <Field label="Text">
            <input ref={nameInputRef} className="input" value={selected.text || ''} onFocus={beginTextEdit} onBlur={endTextEdit} onKeyDown={finishTextField} onChange={e => updateSelected({ text: e.target.value }, { history: false })} />
          </Field>
          <Field label="Style">
            <div className="tabs w-full">
              {LABEL_STYLES.map(s => (
                <button key={s.style} type="button" onClick={() => updateSelected({ style: s.style })} className={`tab flex-1 px-1 ${selected.style === s.style ? 'is-active' : ''}`}>{s.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Size" value={`${Math.round((selected.size || LABEL_BY_STYLE[selected.style]?.defaultSize || 24) * inspectZoom)} px`}>
            <Slider value={brushToSlider(Math.max(BRUSH_MIN, (selected.size || LABEL_BY_STYLE[selected.style]?.defaultSize || 24) * 2))} min={0} max={100} onStart={beginTextEdit} onEnd={endTextEdit} onChange={v => updateSelected({ size: sliderToBrush(v) / 2 }, { history: false })} />
          </Field>
          <Field label="Angle" value={`${Math.round((selected.angle || 0) * 180 / Math.PI)}°`}>
            <Slider value={Math.round((selected.angle || 0) * 180 / Math.PI)} min={-90} max={90} onStart={beginTextEdit} onEnd={endTextEdit} onChange={v => updateSelected({ angle: v * Math.PI / 180 }, { history: false })} />
          </Field>
        </>
      )}

      {selection.type === 'path' && (
        <>
          <Field label="Kind">
            <div className="flex flex-wrap gap-1">
              {PATH_KINDS.map(k => (
                <button key={k.kind} type="button" onClick={() => updateSelected({ kind: k.kind })} className={`btn btn-sm ${selected.kind === k.kind ? 'btn-primary' : 'btn-outline'}`}>{k.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Width" value={`${Math.round((selected.width || 6) * inspectZoom * 10) / 10} px`}>
            <Slider value={brushToSlider(Math.max(BRUSH_MIN, (selected.width || 6) * 4))} min={0} max={100} onStart={beginTextEdit} onEnd={endTextEdit} onChange={v => updateSelected({ width: sliderToBrush(v) / 4 }, { history: false })} />
          </Field>
          {selected.kind === 'ink' && (
            <Field label="Colour">
              <div className="flex gap-1.5">
                {INK_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => updateSelected({ color: c })} aria-label={c} className={`size-6 rounded-full border border-foreground/15 ${selected.color === c ? 'ring-2 ring-brand ring-offset-1 ring-offset-popover' : ''}`} style={{ background: c }} />
                ))}
              </div>
            </Field>
          )}
        </>
      )}

      {selection.type === 'path' && (selected.kind === 'ink' || selected.kind === 'border') && selected.points?.length > 2 && (
        <button type="button" className="btn btn-outline btn-sm mt-3 w-full" onClick={() => outlineToLand(selected)}>
          <PaintBucket /> Turn into land
        </button>
      )}

      {selection.type === 'stamp' && (
        <>
          <Field label="Size" value={selected.size}>
            <Slider value={selected.size || 48} min={16} max={600} onStart={beginTextEdit} onEnd={endTextEdit} onChange={v => updateSelected({ size: v }, { history: false })} />
          </Field>
          <Field label="Rotation" value={`${selected.rotation || 0}°`}>
            <Slider value={selected.rotation || 0} min={-180} max={180} onStart={beginTextEdit} onEnd={endTextEdit} onChange={v => updateSelected({ rotation: v }, { history: false })} />
          </Field>
          <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => updateSelected({ flipX: !selected.flipX })}><FlipHorizontal /> Flip</button>
        </>
      )}

      {(selection.type === 'pin' || selection.type === 'protagonist') && (() => {
        const type = selection.type === 'protagonist' ? 'characters' : selected.entityType;
        const ent = lookupEntity(type, selected.entityId);
        return ent ? (
          <button type="button" className="btn btn-outline btn-sm w-full justify-start" onClick={() => navigate(`/${type}/${ent.id}`)}>
            <ExternalLink /> <span className="truncate">Open {ent.name}</span>
          </button>
        ) : <p className="text-sm text-muted-foreground">This entry no longer exists.</p>;
      })()}

      <button type="button" className="btn btn-destructive btn-sm mt-4 w-full" onClick={deleteSelection}>
        <Trash2 /> Remove
      </button>
    </Panel>
  );

  const layersMenu = (
    <Menu
      align="end"
      className="w-56"
      trigger={(props) => (
        <button {...props} type="button" className="btn btn-ghost btn-icon" title="Layers" aria-label="Layers"><Layers /></button>
      )}
    >
      <MenuLabel>Show on map</MenuLabel>
      {LAYERS.filter(l => l.key !== 'reference' || doc.reference).map(l => (
        <MenuItem key={l.key} checked={!doc.hidden?.[l.key]} onSelect={() => setHidden(l.key, !doc.hidden?.[l.key])}>{l.label}</MenuItem>
      ))}
    </Menu>
  );

  const moreMenu = (
    <Menu
      align="end"
      className="w-60"
      trigger={(props) => (
        <button {...props} type="button" className="btn btn-ghost btn-icon" title="More" aria-label="More"><MoreHorizontal /></button>
      )}
    >
      {isPhone && <MenuItem icon={Sparkles} onSelect={() => setShowGenerate({ firstTime: false })}>Generate land…</MenuItem>}
      {isPhone && <MenuItem icon={Download} onSelect={exportPng}>Export as PNG</MenuItem>}
      <MenuItem icon={ImageIcon} onSelect={addReferenceImage}>{doc.reference ? 'Replace reference image…' : 'Add reference image to trace…'}</MenuItem>
      {doc.reference && (
        <>
          <div className="px-2 py-1.5">
            <p className="mb-1 text-xs text-muted-foreground">Reference opacity</p>
            <Slider value={Math.round((doc.reference.opacity ?? 0.6) * 100)} min={5} max={100} onChange={v => { setDoc({ ...docRef.current, reference: { ...docRef.current.reference, opacity: v / 100 } }); scheduleSave('doc'); }} />
          </div>
          <MenuItem icon={X} onSelect={() => commitDoc({ ...docRef.current, reference: null })}>Remove reference image</MenuItem>
        </>
      )}
      <MenuSeparator />
      {!isPhone && <MenuItem icon={Keyboard} onSelect={() => setShowShortcuts(true)}>Keyboard shortcuts</MenuItem>}
      <MenuItem icon={Trash2} danger onSelect={() => setConfirmDelete(true)}>Delete map</MenuItem>
    </Menu>
  );

  const protagonistEntity = doc.protagonist ? lookupEntity('characters', doc.protagonist.entityId) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-background px-2 sm:px-3">
        <button type="button" onClick={() => navigate('/maps')} className="btn btn-ghost btn-icon" aria-label="Back to maps"><ArrowLeft /></button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {renaming ? (
            <input
              autoFocus
              className="input h-8 max-w-xs"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setDraftName(map.name || ''); setRenaming(false); } }}
            />
          ) : (
            <button type="button" onClick={() => { setDraftName(map.name || ''); setRenaming(true); }} className="min-w-0 truncate rounded-md px-1.5 py-1 text-sm font-semibold hover:bg-accent" title="Rename">
              {map.name || 'Untitled map'}
            </button>
          )}
          <span className={`hidden shrink-0 text-xs sm:inline ${saveState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{saveLabel}</span>
        </div>
        {mode === 'edit' && (
          <>
            <button type="button" className="btn btn-ghost btn-icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 /></button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 /></button>
          </>
        )}
        {mode === 'view' && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setFindOpen(o => !o)} title="Find a place (/)" aria-label="Find a place"><Search /></button>
        )}
        <div className="tabs mx-1" role="tablist" aria-label="Mode">
          <button type="button" role="tab" aria-selected={mode === 'view'} onClick={() => setMode('view')} className="tab inline-flex items-center gap-1.5" title="View (E)">
            <Eye size={14} /> <span className="max-sm:hidden">View</span>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')} className="tab inline-flex items-center gap-1.5" title="Edit (E)">
            <Pencil size={14} /> <span className="max-sm:hidden">Edit</span>
          </button>
        </div>
        {!isPhone && (
          <>
            {mode === 'edit' && (
              <button type="button" className="btn btn-outline" onClick={() => setShowGenerate({ firstTime: false })} disabled={!terrainReady}><Sparkles /> Generate land</button>
            )}
            <button type="button" className="btn btn-ghost btn-icon" onClick={exportPng} title="Export as PNG" aria-label="Export as PNG"><Download /></button>
          </>
        )}
        {layersMenu}
        {moreMenu}
      </header>

      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 select-none overflow-hidden"
        style={{ touchAction: 'none', cursor, background: PAPER.sea }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={e => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block" />

        {/* Pins */}
        {!pinsHidden && (
          <div ref={overlayRef} className="pointer-events-none absolute left-0 top-0" style={{ transformOrigin: '0 0' }}>
            {doc.pins.map(pin => {
              const ent = lookupEntity(pin.entityType, pin.entityId);
              if (!ent) return null;
              const meta = TYPE_META[pin.entityType] || TYPE_META.things;
              const isSel = selection?.type === 'pin' && selection.id === pin.id;
              return (
                <div
                  key={pin.id}
                  title={ent.name}
                  onPointerDown={e => pinDown(e, 'pin', pin.id)}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-full ${isSel ? 'drop-shadow-[0_0_0_2px_#3b5bdb]' : ''}`}
                  style={{ left: `calc(${pin.x}px * var(--z, 1))`, top: `calc(${pin.y}px * var(--z, 1))`, cursor: mode === 'view' ? 'pointer' : tool === 'select' ? 'grab' : undefined }}
                >
                  <PinMarker color={meta.color} Icon={meta.icon} />
                  <span className={`absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#f4ecd6]/90 px-1 text-[11px] font-medium text-[#3a2e20] ${isSel ? 'ring-1 ring-brand' : ''}`}>{ent.name}</span>
                </div>
              );
            })}
            {doc.protagonist && protagonistEntity && (
              <div
                title={`${protagonistEntity.name} (protagonist)`}
                onPointerDown={e => pinDown(e, 'protagonist', 'protagonist')}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `calc(${doc.protagonist.x}px * var(--z, 1))`, top: `calc(${doc.protagonist.y}px * var(--z, 1))`, cursor: mode === 'view' ? 'pointer' : tool === 'select' ? 'grab' : undefined }}
              >
                <PinMarker color={PROTAGONIST_COLOR} Icon={Star} protagonist />
                <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#f4ecd6]/90 px-1 text-[11px] font-semibold text-[#3a2e20]">{protagonistEntity.name}</span>
              </div>
            )}
          </div>
        )}

        {!terrainReady && !terrainError && (
          <div className="absolute inset-0 grid place-items-center text-sm text-[#5b4a3a]">Loading map…</div>
        )}
        {terrainError && (
          <div className="absolute inset-x-4 top-4 rounded-lg bg-popover p-3 text-sm text-destructive shadow-md ring-1 ring-foreground/10">{terrainError}</div>
        )}

        {/* Tools */}
        {mode === 'edit' && <div
          className={`absolute z-10 flex gap-0.5 rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10 ${
            isPhone ? 'bottom-2 left-2 right-2 overflow-x-auto scrollbar-none' : 'left-3 top-3 flex-col'
          }`}
          onPointerDown={e => e.stopPropagation()}
        >
          {TOOLS.map(t => (
            <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => { if (tool === t.id && isPhone) setOptionsOpen(o => !o); else setTool(t.id); }} />
          ))}
        </div>}

        {/* Options & inspector */}
        {mode === 'edit' && <div
          className={`absolute z-10 flex flex-col gap-2 ${isPhone ? 'bottom-[3.75rem] left-2 right-2 max-h-[45%] overflow-y-auto' : 'left-[3.75rem] top-3 max-h-[calc(100%-1.5rem)] overflow-y-auto'}`}
          onPointerDown={e => e.stopPropagation()}
        >
          {inspector || (optionsOpen && optionsPanel)}
          {isPhone && !inspector && hasOptions && !optionsOpen && (
            <button type="button" className="btn btn-outline btn-sm self-start bg-popover" onClick={() => setOptionsOpen(true)}><ChevronUp /> {toolDef?.label} options</button>
          )}
        </div>}

        {/* View mode: find a place */}
        {mode === 'view' && findOpen && (
          <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-80" onPointerDown={e => e.stopPropagation()}>
            <Panel>
              <div className="relative pt-2">
                <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  className="input pl-8"
                  placeholder="Find a place…"
                  value={findQuery}
                  onChange={e => setFindQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setFindOpen(false);
                    if (e.key === 'Enter' && findResults[0]) goToResult(findResults[0]);
                  }}
                />
              </div>
              {findResults.length > 0 ? (
                <div className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {findResults.map(r => (
                    <button key={`${r.kind}-${r.id}`} type="button" onClick={() => goToResult(r)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-accent">
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.sub}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 px-1 text-xs text-muted-foreground">{findQuery ? 'Nothing by that name.' : 'Named places, labels and pins.'}</p>
              )}
            </Panel>
          </div>
        )}

        {/* View mode: what was clicked */}
        {mode === 'view' && viewCard && cardInfo && (
          <div
            className="absolute z-10 w-64 animate-menu"
            style={{ left: `max(8px, min(${viewCard.sx + 12}px, calc(100% - 264px)))`, top: Math.max(8, viewCard.sy - 20) }}
            onPointerDown={e => e.stopPropagation()}
          >
            <Panel title={cardInfo.sub} onClose={() => showCard(null)}>
              <p className="text-base font-semibold leading-snug">{cardInfo.name}</p>
              {cardInfo.entity ? (
                <button type="button" className="btn btn-outline btn-sm mt-3 w-full justify-start" onClick={() => navigate(`/${cardInfo.entityType}/${cardInfo.entity.id}`)}>
                  <ExternalLink /> <span className="truncate">Open {cardInfo.entity.name}</span>
                </button>
              ) : cardInfo.kind === 'place' && (
                <p className="mt-1.5 text-xs text-muted-foreground">Not linked to an entry. Link one in Edit mode.</p>
              )}
            </Panel>
          </div>
        )}

        {/* Zoom */}
        <div
          className={`absolute z-10 flex items-center gap-0.5 rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10 ${isPhone ? 'right-2 top-2 flex-col' : 'bottom-3 right-3'}`}
          onPointerDown={e => e.stopPropagation()}
        >
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => zoomBy(0.8)} aria-label="Zoom out"><ZoomOut /></button>
          {!isPhone && <span ref={zoomLabelRef} className="w-12 text-center text-xs tabular-nums text-muted-foreground">{initialZoomText}</span>}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => zoomBy(1.25)} aria-label="Zoom in"><ZoomIn /></button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={fitMap} title="Fit the map (0)" aria-label="Fit the map"><Maximize /></button>
          <button
            type="button"
            className={`btn btn-icon btn-sm ${measuring ? 'btn-brand' : 'btn-ghost'}`}
            onClick={() => setMeasuring(!measuring)}
            title="Measure distance (M)"
            aria-label="Measure distance"
            aria-pressed={measuring}
          >
            <Ruler />
          </button>
        </div>

        {toast && (
          <div className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-lg bg-popover px-3 py-2 text-sm shadow-md ring-1 ring-foreground/10 animate-menu ${isPhone ? 'top-3' : 'bottom-4'}`}>{toast}</div>
        )}
      </div>

      {showGenerate && (
        <GenerateModal firstTime={showGenerate.firstTime} onGenerate={runGenerate} onClose={() => { setShowGenerate(false); if (map.autoGenerate) updateMapMeta(map.id, { autoGenerate: false }); }} />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {picker && (
        <EntityPicker
          title={picker.linkPlace ? 'Link a location' : picker.protagonist ? 'Choose the protagonist' : 'Pin an entry'}
          allowedTypes={picker.linkPlace ? ['locations'] : picker.protagonist ? ['characters'] : null}
          onPick={onPickEntity}
          onClose={() => setPicker(null)}
        />
      )}
      {pendingUpload && (
        <CustomStampUploadModal
          initialName={pendingUpload.initialName}
          svg={pendingUpload.svg}
          onClose={() => setPendingUpload(null)}
          onSave={async ({ name, tags, svg }) => {
            const saved = await addCustomStamp({ name, tags, svg });
            setPendingUpload(null);
            if (saved?.id) setOpts({ stamp: { src: 'svg', ref: saved.id, name } });
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete map"
          message={`Delete "${map.name || 'this map'}"? It moves to the trash.`}
          onConfirm={async () => {
            clearTimeout(saveTimerRef.current);
            dirtyRef.current = { doc: false, terrain: false };
            await deleteMap(map.id);
            navigate('/maps');
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

// A faint square grid whose spacing doubles as you zoom out, so lines stay
// at least ~28 px apart.
function drawGrid(ctx, view) {
  let step = 64;
  while (step * view.zoom < 28) step *= 2;
  const r = visibleRect(view);
  ctx.save();
  ctx.strokeStyle = 'rgba(60,45,30,0.14)';
  ctx.lineWidth = 1 / view.zoom;
  ctx.beginPath();
  for (let x = Math.floor(r.minX / step) * step; x <= r.maxX; x += step) { ctx.moveTo(x, r.minY); ctx.lineTo(x, r.maxY); }
  for (let y = Math.floor(r.minY / step) * step; y <= r.maxY; y += step) { ctx.moveTo(r.minX, y); ctx.lineTo(r.maxX, y); }
  ctx.stroke();
  ctx.restore();
}
