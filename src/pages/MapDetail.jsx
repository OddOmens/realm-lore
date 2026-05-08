import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pin, Star, Trash2, X, ZoomIn, ZoomOut, Maximize,
  Users, Map as MapIcon, Box, BookMarked, Flag, PawPrint, Search,
  Pencil, Image as ImageIcon, Check, Hand, Eraser, Undo2, Redo2,
  Stamp as StampIcon, Layers as LayersIcon, Eye, EyeOff, Upload, Plus,
  Grid3x3, RotateCw, FlipHorizontal, FlipVertical, Palette,
  Type,
  Ruler, Download, Copy, Trash, AlignCenter,
  Trees, TreePine, Mountain, MountainSnow, Castle, Home, Building2,
  Tent, Skull, Sword, Flame, Waves, Anchor, Cross, Compass, Crown, Sparkles,
} from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

// ── Per-entity-type metadata for pin styling and the picker UI ─────────────────
const TYPE_META = {
  characters: { icon: Users,      color: '#60a5fa', label: 'Character' },
  locations:  { icon: MapIcon,    color: '#34d399', label: 'Location'  },
  things:     { icon: Box,        color: '#fbbf24', label: 'Thing'     },
  lore:       { icon: BookMarked, color: '#a78bfa', label: 'Lore'      },
  factions:   { icon: Flag,       color: '#818cf8', label: 'Faction'   },
  creatures:  { icon: PawPrint,   color: '#fb923c', label: 'Creature'  },
};

const PROTAGONIST_COLOR = '#facc15';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;

// Default workspace sizes: blank maps get a large “endless” canvas; legacy populated maps without
// `canvasSize` keep the historical extent so normalized pins/stamps don’t jump.
const LARGE_CANVAS = { w: 32768, h: 32768 };
const LEGACY_CANVAS = { w: 2000, h: 1500 };
const GRID_CELL = 32;

// ── Layers ────────────────────────────────────────────────────────────────────
// Maps now have a stack of named layers. Pen strokes record `layerId`. Stamps
// and pins are special "layers" that only carry visibility (their content
// already lives on `map.stamps` / `map.pins`). We render bottom→top, so
// `terrain` is the visual base and `pins` ride on top.
const DEFAULT_LAYERS = [
  { id: 'terrain',     name: 'Terrain',     kind: 'pen',    visible: true, color: '#1a1a1a', defaultSize: 4 },
  { id: 'rivers',      name: 'Rivers',      kind: 'pen',    visible: true, color: '#2563eb', defaultSize: 3 },
  { id: 'roads',       name: 'Roads',       kind: 'pen',    visible: true, color: '#7c2d12', defaultSize: 3 },
  { id: 'annotations', name: 'Annotations', kind: 'pen',    visible: true, color: '#dc2626', defaultSize: 2 },
  { id: 'stamps',      name: 'Stamps',      kind: 'stamps', visible: true },
  { id: 'pins',        name: 'Pins',        kind: 'pins',   visible: true },
];
// Bottom → top render order for pen layers. Stamps & pins always render above
// pen layers in this order: terrain, rivers, roads, annotations, stamps, pins.
const PEN_LAYER_ORDER = ['terrain', 'rivers', 'roads', 'annotations'];

function defaultLayers() { return DEFAULT_LAYERS.map(l => ({ ...l })); }

// ── Stamp library ─────────────────────────────────────────────────────────────
// Decorative map symbols. Stamps live as { id, kind, x, y, size, color } on the
// map document. `kind` keys back into this library so we never serialize the
// React component itself — only the small string key.
const STAMP_LIBRARY = [
  { kind: 'forest',     label: 'Forest',       icon: Trees,        color: '#16a34a', tags: ['nature', 'forest'] },
  { kind: 'pines',      label: 'Pine forest',  icon: TreePine,     color: '#15803d', tags: ['nature', 'forest'] },
  { kind: 'mountain',   label: 'Mountain',     icon: Mountain,     color: '#78716c', tags: ['nature', 'terrain'] },
  { kind: 'snowypeak',  label: 'Snowy peak',   icon: MountainSnow, color: '#94a3b8', tags: ['nature', 'terrain'] },
  { kind: 'volcano',    label: 'Volcano',      icon: Flame,        color: '#dc2626', tags: ['nature', 'danger'] },
  { kind: 'sea',        label: 'Sea / Lake',   icon: Waves,        color: '#0369a1', tags: ['water'] },
  { kind: 'port',       label: 'Port',         icon: Anchor,       color: '#0c4a6e', tags: ['water', 'settlement'] },
  { kind: 'capital',    label: 'Capital',      icon: Crown,        color: '#d97706', tags: ['settlement'] },
  { kind: 'city',       label: 'City',         icon: Building2,    color: '#9a3412', tags: ['settlement'] },
  { kind: 'castle',     label: 'Castle',       icon: Castle,       color: '#7c2d12', tags: ['settlement', 'fortification'] },
  { kind: 'village',    label: 'Village',      icon: Home,         color: '#a16207', tags: ['settlement'] },
  { kind: 'camp',       label: 'Camp',         icon: Tent,         color: '#854d0e', tags: ['settlement'] },
  { kind: 'dungeon',    label: 'Dungeon',      icon: Skull,        color: '#1c1917', tags: ['danger', 'mystical'] },
  { kind: 'battle',     label: 'Battle',       icon: Sword,        color: '#991b1b', tags: ['danger'] },
  { kind: 'shrine',     label: 'Shrine',       icon: Cross,        color: '#a855f7', tags: ['mystical'] },
  { kind: 'magic',      label: 'Magic site',   icon: Sparkles,     color: '#7c3aed', tags: ['mystical'] },
  { kind: 'compass',    label: 'Compass rose', icon: Compass,      color: '#1e293b', tags: ['marker'] },
];

const STAMP_BY_KIND = Object.fromEntries(STAMP_LIBRARY.map(s => [s.kind, s]));

const STAMP_SIZES = [32, 48, 72]; // world units; default 48
const DEFAULT_STAMP_SIZE = 48;

// 8-color palette + "custom" hex input
const PEN_COLORS = ['#1a1a1a', '#dc2626', '#16a34a', '#2563eb', '#7c2d12', '#7c3aed', '#0891b2', '#f5f0e1'];
const PEN_SIZES = [2, 4, 8, 16];
const ERASER_SIZES = [12, 24, 48];

const UNDO_LIMIT = 80;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; }

// ── Island/Region Shape Generator ─────────────────────────────────────────────
// Generates organic-looking landmass shapes using noise and smoothing
function generateIslandShape(centerX, centerY, size, complexity = 'medium', type = 'island') {
  const points = [];
  const numPoints = complexity === 'simple' ? 12 : complexity === 'medium' ? 24 : 48;
  const baseRadius = size / 2;
  
  // Generate points around a circle with random variation
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    
    // Add noise to radius for organic shape
    let radiusVariation;
    if (type === 'island') {
      // Islands are more circular with moderate variation
      radiusVariation = 0.7 + Math.random() * 0.5;
    } else if (type === 'continent') {
      // Continents have more dramatic variation
      radiusVariation = 0.5 + Math.random() * 0.8;
    } else if (type === 'archipelago') {
      // Archipelago has extreme variation for fragmented look
      radiusVariation = 0.3 + Math.random() * 1.0;
    } else {
      // Region/custom
      radiusVariation = 0.6 + Math.random() * 0.6;
    }
    
    const radius = baseRadius * radiusVariation;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    points.push([x, y]);
  }
  
  // Close the shape
  points.push([...points[0]]);
  
  return points;
}

function generateCoastline(centerX, centerY, size, detail = 'medium') {
  const points = [];
  const numPoints = detail === 'low' ? 32 : detail === 'medium' ? 64 : 128;
  const baseRadius = size / 2;
  
  // Create a more detailed coastline with multiple frequency noise
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    
    // Layer multiple noise frequencies for realistic coastline
    const noise1 = Math.sin(angle * 3 + Math.random() * 0.5) * 0.15;
    const noise2 = Math.sin(angle * 7 + Math.random() * 0.3) * 0.08;
    const noise3 = Math.sin(angle * 13 + Math.random() * 0.2) * 0.04;
    
    const radiusVariation = 0.8 + noise1 + noise2 + noise3;
    const radius = baseRadius * radiusVariation;
    
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    points.push([x, y]);
  }
  
  points.push([...points[0]]);
  return points;
}

// Color tint helpers for stamps
function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function getOpLabel(op) {
  if (op.type === 'add') return 'Draw stroke';
  if (op.type === 'delete') return 'Erase stroke';
  if (op.type === 'clear') return 'Clear all';
  if (op.type === 'add-stamp') return 'Add stamp';
  if (op.type === 'delete-stamp') return 'Remove stamp';
  if (op.type === 'move-stamp') return 'Move stamp';
  if (op.type === 'patch-stamp') return 'Edit stamp';
  return op.type;
}

function getHueRotation(hex) {
  const [h] = hexToHsl(hex || '#ff0000');
  return h - 30; // Base sepia shifts to ~30deg, so subtract to get target
}

function getSaturation(hex) {
  const [, s] = hexToHsl(hex || '#ff0000');
  return s;
}

// Build SVG path "d" attribute from a list of [x,y] points using quadratic
// Bézier midpoint smoothing — a classic "natural ink" technique:
//   • Start at the first point.
//   • Draw a short line to the midpoint of P0 and P1.
//   • For each interior point Pi, draw a quadratic curve from the previous
//     midpoint to the next midpoint, using Pi as the control point. The curve
//     therefore *passes through* midpoints (which average out cursor jitter)
//     while bending naturally toward each sample.
//   • End with a line to the final point so the stroke terminates exactly
//     where the user lifted the pen.
// This works for the live in-progress stroke and committed strokes alike,
// so existing drawings look smoother retroactively with no migration.
function pointsToPathD(points) {
  if (!points || points.length === 0) return '';
  const fmt = (n) => n.toFixed(1);
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${fmt(x)} ${fmt(y)}`;
  }
  if (points.length === 2) {
    const [x0, y0] = points[0];
    const [x1, y1] = points[1];
    return `M ${fmt(x0)} ${fmt(y0)} L ${fmt(x1)} ${fmt(y1)}`;
  }

  const [sx, sy] = points[0];
  // Start with a line into the first midpoint so the curve actually begins
  // at the user's pen-down point and not somewhere drifted toward P1.
  const [mx0, my0] = [(sx + points[1][0]) / 2, (sy + points[1][1]) / 2];
  let d = `M ${fmt(sx)} ${fmt(sy)} L ${fmt(mx0)} ${fmt(my0)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const midX = (cx + nx) / 2;
    const midY = (cy + ny) / 2;
    d += ` Q ${fmt(cx)} ${fmt(cy)} ${fmt(midX)} ${fmt(midY)}`;
  }

  const [ex, ey] = points[points.length - 1];
  d += ` L ${fmt(ex)} ${fmt(ey)}`;
  return d;
}

// Returns true if any segment of `stroke` lies within `radius` of `(px,py)`.
// Point-to-point distance is sufficient for typical stroke densities and
// keeps the eraser feel snappy without expensive segment math.
function strokeIntersectsPoint(stroke, px, py, radius) {
  const r = radius + (stroke.size || 4) / 2;
  const r2 = r * r;
  for (const [x, y] of stroke.points) {
    if (dist2(x, y, px, py) <= r2) return true;
  }
  return false;
}

// Defensive sanitization for user-uploaded SVGs. We render via <img src=
// "data:image/svg+xml,...">, which already disables script execution, but
// strip the obvious vectors anyway as belt-and-suspenders.
function sanitizeSvg(input) {
  if (typeof input !== 'string') return '';
  let s = input;
  // strip <script>...</script> entirely
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  // strip event handler attrs (on*)
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  // strip javascript: URLs in href / xlink:href / src
  s = s.replace(/(href|xlink:href|src)\s*=\s*"javascript:[^"]*"/gi, '$1=""');
  s = s.replace(/(href|xlink:href|src)\s*=\s*'javascript:[^']*'/gi, "$1=''");
  // strip <foreignObject> (HTML embedding inside SVG, surface for XSS)
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  return s.trim();
}

// Build a data-URI from sanitized SVG markup. Memoizing per stamp avoids
// re-encoding on every render.
function svgToDataUri(svg) {
  if (!svg) return '';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── Pin marker SVG ────────────────────────────────────────────────────────────
function PinMarker({ color, Icon, isProtagonist }) {
  const size = isProtagonist ? 36 : 28;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: 'block', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.45))' }}
    >
      <path
        d="M16 1 C 8 1 3 7 3 14 C 3 22 16 31 16 31 C 16 31 29 22 29 14 C 29 7 24 1 16 1 Z"
        fill={color}
        stroke="white"
        strokeWidth={1.5}
      />
      <circle cx={16} cy={13} r={6.5} fill="white" />
      <foreignObject x={9} y={6} width={14} height={14}>
        <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={11} color={color} strokeWidth={2.5} />
        </div>
      </foreignObject>
    </svg>
  );
}

// ── Entity picker (used for both adding pins and choosing protagonist) ───────
function EntityPicker({ title, allowedTypes, onPick, onClose }) {
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);
  const [query, setQuery] = useState('');

  const all = useMemo(() => {
    const out = [];
    const add = (arr, type) => {
      if (allowedTypes && !allowedTypes.includes(type)) return;
      for (const e of arr) if (e.name) out.push({ ...e, _type: type });
    };
    add(characters, 'characters');
    add(locations, 'locations');
    add(things, 'things');
    add(lore.filter(e => !e._isTimelineEvent), 'lore');
    add(factions, 'factions');
    add(creatures, 'creatures');
    return out;
  }, [characters, locations, things, lore, factions, creatures, allowedTypes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(e => e.name.toLowerCase().includes(q));
  }, [all, query]);

  return (
    <Modal title={title} onClose={onClose} size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full bg-secondary text-foreground text-sm rounded-md pl-9 pr-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-6 text-center">No entities match.</p>
          ) : (
            filtered.map(e => {
              const meta = TYPE_META[e._type];
              const Icon = meta.icon;
              return (
                <button
                  key={`${e._type}-${e.id}`}
                  onClick={() => onPick(e)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/60 transition-colors"
                >
                  <span
                    className="shrink-0 w-7 h-7 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${meta.color}22`, border: `1px solid ${meta.color}55` }}
                  >
                    <Icon size={13} style={{ color: meta.color }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{meta.label}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Custom stamp upload modal ─────────────────────────────────────────────────
// Presented after the user picks an SVG file. We've already sanitized + read
// the file; the modal collects a friendly name and tags, then commits.
function CustomStampUploadModal({ initialName, svg, onSave, onClose }) {
  const [name, setName] = useState(initialName || '');
  const [tagsRaw, setTagsRaw] = useState('');
  const [error, setError] = useState('');

  const tags = useMemo(
    () => tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
    [tagsRaw]
  );

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) { setError('Give your stamp a name.'); return; }
    if (!svg) { setError('SVG content is empty.'); return; }
    await onSave({ name: cleanName, tags, svg });
  };

  return (
    <Modal title="Add custom stamp" onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-center bg-secondary/40 border border-border rounded-md p-6 min-h-32">
          <img
            src={svgToDataUri(svg)}
            alt="Stamp preview"
            style={{ maxWidth: 96, maxHeight: 96, display: 'block' }}
            draggable={false}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Black tower"
            className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Tags</label>
          <input
            value={tagsRaw}
            onChange={e => setTagsRaw(e.target.value)}
            placeholder="comma, separated, tags"
            className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{t}</span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">Tags help filter the stamp picker. Try things like “fortification”, “ruin”, “forest”.</p>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save stamp
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Tool palette (left edge) ──────────────────────────────────────────────────
function ToolButton({ active, onClick, title, children, danger }) {
  const base = 'w-9 h-9 flex items-center justify-center rounded-md transition-colors border';
  const classes = active
    ? 'bg-primary text-primary-foreground border-primary'
    : danger
      ? 'border-transparent text-muted-foreground hover:text-red-400 hover:bg-red-500/10'
      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary';
  return (
    <button onClick={onClick} title={title} className={`${base} ${classes}`}>
      {children}
    </button>
  );
}

// ── Layer panel row ───────────────────────────────────────────────────────────
function LayerRow({ layer, active, onClickActivate, onToggleVisibility, onDelete, onRename, onMoveUp, onMoveDown, canDelete, canMoveUp, canMoveDown, editing, editingName, onStartEdit, onCancelEdit, onSaveEdit }) {
  const isPen = layer.kind === 'pen';
  
  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          autoFocus
          value={editingName}
          onChange={(e) => onSaveEdit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' ? onSaveEdit(editingName) : e.key === 'Escape' ? onCancelEdit() : null}
          onBlur={() => onSaveEdit(editingName)}
          className="flex-1 bg-secondary text-foreground text-xs rounded px-1 py-0.5 border border-border focus:outline-none"
        />
      </div>
    );
  }
  
  return (
    <div
      onClick={isPen ? onClickActivate : undefined}
      className={`group flex items-center gap-1 px-2 py-1.5 rounded transition-colors ${
        isPen ? 'cursor-pointer' : 'cursor-default'
      } ${active ? 'bg-primary/15 border border-primary/40' : 'border border-transparent hover:bg-secondary/60'}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title={layer.visible === false ? 'Show layer' : 'Hide layer'}
      >
        {layer.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      {isPen ? (
        <span
          className="w-3 h-3 rounded-sm border border-black/20 shrink-0"
          style={{ backgroundColor: layer.color }}
        />
      ) : layer.kind === 'stamps' ? (
        <StampIcon size={12} className="text-muted-foreground" />
      ) : (
        <Pin size={12} className="text-muted-foreground" />
      )}
      <span className={`text-xs flex-1 truncate ${active ? 'text-foreground font-semibold' : 'text-foreground/85'}`}>
        {layer.name}
      </span>
      {active && <span className="text-[10px] text-primary uppercase tracking-wider font-semibold">Active</span>}
      {isPen && (
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={!canMoveUp} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move up">
            <span className="text-[10px]">↑</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={!canMoveDown} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move down">
            <span className="text-[10px]">↓</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onStartEdit(); }} className="p-0.5 text-muted-foreground hover:text-foreground" title="Rename">
            <span className="text-[10px]">✎</span>
          </button>
          {canDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 text-muted-foreground hover:text-red-400" title="Delete layer">
              <X size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const map = useWorldStore(s => s.maps.find(m => m.id === id));
  const updateMapMeta = useWorldStore(s => s.updateMapMeta);
  const saveMap = useWorldStore(s => s.saveMap);
  const deleteMap = useWorldStore(s => s.deleteMap);
  const customStamps = useWorldStore(s => s.customStamps);
  const addCustomStamp = useWorldStore(s => s.addCustomStamp);
  const deleteCustomStamp = useWorldStore(s => s.deleteCustomStamp);

  // ── Layer model (computed from map; falls back to defaults) ────────────────
  const mapLayers = map?.layers;
  const layers = useMemo(
    () => (Array.isArray(mapLayers) && mapLayers.length > 0) ? mapLayers : defaultLayers(),
    [mapLayers]
  );
  const layerById = useMemo(() => Object.fromEntries(layers.map(l => [l.id, l])), [layers]);
  const isLayerVisible = useCallback(
    (id) => { const l = layerById[id]; return l ? l.visible !== false : true; },
    [layerById]
  );

  // Active pen layer (UI state, not persisted). Constrained to existing pen layers.
  const [activeLayerId, setActiveLayerId] = useState('terrain');
  // If the active layer disappears (rare; future custom layers), drop back to terrain.
  /* eslint-disable react-hooks/set-state-in-effect -- constrain UI selection when layer list changes */
  useEffect(() => {
    if (!layerById[activeLayerId] || layerById[activeLayerId].kind !== 'pen') {
      setActiveLayerId('terrain');
    }
  }, [layerById, activeLayerId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── View transform (pan + zoom). Local-only; never persisted. ──────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // ── Tool & drawing state ───────────────────────────────────────────────────
  // 'view' | 'pen' | 'eraser' | 'stamp' | 'addPin' | 'setProtagonist'
  const [tool, setTool] = useState('view');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[1]);
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES[0]);

  // Stamp selection: a custom PNG/image file. source is always 'library'.
  const [selectedStamp, setSelectedStamp] = useState({ source: 'library', key: '', name: '' });
  const [selectedStampSize, setSelectedStampSize] = useState(DEFAULT_STAMP_SIZE);
  const [hoveredStampId, setHoveredStampId] = useState(null);

  // Stamp transform state (rotation, flip)
  const [stampRotation, setStampRotation] = useState(0);
  const [stampFlipX, setStampFlipX] = useState(false);
  const [stampFlipY, setStampFlipY] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');

  // Stamp picker filters
  const [stampQuery, setStampQuery] = useState('');

  // Custom PNG stamps loaded from filesystem (flat list from customStamps/)
  const [customPngStamps, setCustomPngStamps] = useState([]);
  const [stampsLoading, setStampsLoading] = useState(false);

  // Custom-stamp upload state (SVG upload kept for backward compat but hidden)
  const customStampFileRef = useRef(null);
  const [pendingCustomUpload, setPendingCustomUpload] = useState(null); // { initialName, svg }
  const [customStampToDelete, setCustomStampToDelete] = useState(null);

  // In-progress pen stroke. We mutate a ref for performance and update an
  // imperative SVG path's d-attribute on every move; React state only tracks
  // "are we drawing?" so the live path mounts/unmounts correctly.
  const drawingRef = useRef(null);  // { points: [[x,y]...] } | null
  const livePathRef = useRef(null); // <path> DOM node for in-progress stroke
  const [isDrawing, setIsDrawing] = useState(false);

  // Strokes we're about to delete on the current eraser swipe; rendered as
  // hidden so the user gets immediate visual feedback. Committed on pointerup.
  const [pendingErase, setPendingErase] = useState(() => new Set());
  const erasingRef = useRef(null); // { activeIds: Set }

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // Stack of operations. Each op carries the data needed to invert it.
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const pushOp = (op) => {
    setUndoStack(s => {
      const next = [...s, op];
      if (next.length > UNDO_LIMIT) next.shift();
      return next;
    });
    setRedoStack([]);
  };

  // ── Modes & UI state (pinning) ─────────────────────────────────────────────
  const [pendingPos, setPendingPos] = useState(null);
  const [pickerForProto, setPickerForProto] = useState(false);
  const [hoveredPin, setHoveredPin] = useState(null);
  const [deletingMap, setDeletingMap] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // ── Refs for DOM interaction ───────────────────────────────────────────────
  const viewportRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  const panStateRef = useRef(null);
  const pinDragRef  = useRef(null);
  const [pinGhost, setPinGhost] = useState(null);

  /** While drawing / stamping / placing pins, overlays must not steal pointer events from the viewport. */
  const mapToolsNeedViewportHits =
    tool === 'pen' || tool === 'eraser' || tool === 'stamp' || tool === 'addPin' || tool === 'setProtagonist';

  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showRuler, setShowRuler] = useState(false);

  // Snap to grid helper
  const snapToGridIfEnabled = (x, y) => {
    if (!snapToGrid) return { x, y };
    const cellSize = GRID_CELL;
    return {
      x: Math.round(x / cellSize) * cellSize,
      y: Math.round(y / cellSize) * cellSize,
    };
  };

  // Layer management
  const [addingLayer, setAddingLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);

  const addNewLayer = () => {
    const name = newLayerName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const newLayer = { id, name, kind: 'pen', visible: true, color: PEN_COLORS[0], defaultSize: PEN_SIZES[1] };
    const newLayers = [...layers, newLayer];
    updateMapMeta(map.id, { layers: newLayers });
    setNewLayerName('');
    setAddingLayer(false);
  };

  const deleteLayer = (layerId) => {
    if (layerId === 'terrain' || layerId === 'pins' || layerId === 'stamps') return; // Can't delete reserved layers
    const newLayers = layers.filter(l => l.id !== layerId);
    updateMapMeta(map.id, { layers: newLayers });
    if (activeLayerId === layerId) setActiveLayerId('terrain');
  };

  const renameLayer = (layerId, newName) => {
    const name = newName.trim();
    if (!name) { setEditingLayerId(null); return; }
    const newLayers = layers.map(l => l.id === layerId ? { ...l, name } : l);
    updateMapMeta(map.id, { layers: newLayers });
    setEditingLayerId(null);
  };

  const moveLayer = (layerId, direction) => {
    const idx = layers.findIndex(l => l.id === layerId);
    if (idx === -1) return;
    const newLayers = [...layers];
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= newLayers.length) return;
    [newLayers[idx], newLayers[newIdx]] = [newLayers[newIdx], newLayers[idx]];
    updateMapMeta(map.id, { layers: newLayers });
  };

  // Resolve effective canvas dimensions for rendering and coordinate math.
  const mapImage = map?.image;
  const mapCanvasSize = map?.canvasSize;
  const effectiveSize = useMemo(() => {
    if (mapImage && imgSize.w > 0) return imgSize;
    if (mapCanvasSize?.w && mapCanvasSize?.h) return mapCanvasSize;
    const hasSpatial =
      (map?.strokes?.length > 0) ||
      (map?.pins?.length > 0) ||
      (map?.stamps?.length > 0) ||
      !!map?.protagonist;
    return hasSpatial ? LEGACY_CANVAS : LARGE_CANVAS;
  }, [
    mapImage,
    mapCanvasSize,
    imgSize,
    map?.strokes?.length,
    map?.pins?.length,
    map?.stamps?.length,
    map?.protagonist,
  ]);

  // Reset + fit when the map changes or image (re)loads
  const fitToView = useCallback(() => {
    if (!viewportRef.current || !effectiveSize.w || !effectiveSize.h) return;
    const r = viewportRef.current.getBoundingClientRect();
    const scale = Math.min(r.width / effectiveSize.w, r.height / effectiveSize.h, 1);
    setZoom(scale);
    setPan({
      x: (r.width  - effectiveSize.w * scale) / 2,
      y: (r.height - effectiveSize.h * scale) / 2,
    });
  }, [effectiveSize]);

  // Export map as PNG
  const exportMapAsPng = useCallback(async () => {
    const svgElement = document.querySelector('.map-svg-export');
    if (!svgElement) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = effectiveSize.w;
    const h = effectiveSize.h;
    
    canvas.width = w;
    canvas.height = h;
    
    // Draw background
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);
    
    const data = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      
      // Download
      const link = document.createElement('a');
      link.download = `${map?.name || 'map'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [map, effectiveSize]);

  // Zoom to fit all content
  const zoomToFit = useCallback(() => {
    if (!viewportRef.current) return;
    const stamps = map?.stamps || [];
    const pins = map?.pins || [];
    const strokes = map?.strokes || [];
    
    if (stamps.length === 0 && pins.length === 0 && strokes.length === 0) {
      fitToView();
      return;
    }
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Include stamp positions
    for (const s of stamps) {
      const sx = s.x * effectiveSize.w;
      const sy = s.y * effectiveSize.h;
      const size = s.size || DEFAULT_STAMP_SIZE;
      minX = Math.min(minX, sx - size/2);
      minY = Math.min(minY, sy - size/2);
      maxX = Math.max(maxX, sx + size/2);
      maxY = Math.max(maxY, sy + size/2);
    }
    
    // Include pin positions
    for (const p of pins) {
      minX = Math.min(minX, p.x * effectiveSize.w);
      minY = Math.min(minY, p.y * effectiveSize.h);
      maxX = Math.max(maxX, p.x * effectiveSize.w);
      maxY = Math.max(maxY, p.y * effectiveSize.h);
    }
    
    // Include stroke points
    for (const stroke of strokes) {
      for (const [px, py] of stroke.points) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
    
    // Add padding
    const padding = 100;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;
    
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    
    if (contentW <= 0 || contentH <= 0) {
      fitToView();
      return;
    }
    
    const r = viewportRef.current.getBoundingClientRect();
    const scale = Math.min(r.width / contentW, r.height / contentH, 2);
    
    setZoom(scale);
    setPan({
      x: (r.width - contentW * scale) / 2 - minX * scale,
      y: (r.height - contentH * scale) / 2 - minY * scale,
    });
  }, [map, effectiveSize, fitToView]);

  useLayoutEffect(() => {
    if (map && (!map.image || imgLoaded)) fitToView();
  }, [imgLoaded, fitToView, id, map]);

  useEffect(() => {
    const onResize = () => fitToView();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToView]);

  // ── Coordinate helpers ─────────────────────────────────────────────────────
  const eventToWorld = (e) => {
    if (!viewportRef.current) return null;
    const r = viewportRef.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    return { x: (px - pan.x) / zoom, y: (py - pan.y) / zoom };
  };

  const eventToNorm = (e) => {
    const w = eventToWorld(e);
    if (!w || !effectiveSize.w || !effectiveSize.h) return null;
    return {
      x: clamp(w.x / effectiveSize.w, 0, 1),
      y: clamp(w.y / effectiveSize.h, 0, 1),
    };
  };

  // ── Drawing ops ────────────────────────────────────────────────────────────
  const beginPenStroke = (e) => {
    // Refuse to draw on a hidden layer — would be invisible / surprising.
    if (!isLayerVisible(activeLayerId)) return;
    const w = eventToWorld(e);
    if (!w) return;
    drawingRef.current = { points: [[w.x, w.y]] };
    setIsDrawing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    // Live <path> mounts after paint — sync initial point so tiny strokes still render.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const live = livePathRef.current;
        const cur = drawingRef.current;
        if (live && cur?.points?.length) live.setAttribute('d', pointsToPathD(cur.points));
      });
    });
  };

  const extendPenStroke = (e) => {
    const d = drawingRef.current;
    if (!d) return;
    const w = eventToWorld(e);
    if (!w) return;
    const last = d.points[d.points.length - 1];
    const dx = w.x - last[0], dy = w.y - last[1];
    // Lenient threshold so strokes register even at high zoom / slow pointers.
    if (dx * dx + dy * dy < 0.04) return;
    d.points.push([w.x, w.y]);
    if (livePathRef.current) {
      livePathRef.current.setAttribute('d', pointsToPathD(d.points));
    }
  };

  const endPenStroke = () => {
    const d = drawingRef.current;
    drawingRef.current = null;
    setIsDrawing(false);
    if (!d || d.points.length < 1) return;
    let points = d.points;
    if (points.length === 1) {
      const [x, y] = points[0];
      points = [[x, y], [x + 0.5, y + 0.5]];
    }
    const stroke = {
      id: uuidv4(),
      tool: 'pen',
      layerId: activeLayerId,
      color: penColor,
      size: penSize,
      points,
    };
    const newStrokes = [...(map.strokes || []), stroke];
    updateMapMeta(map.id, { strokes: newStrokes });
    pushOp({ type: 'add', strokeId: stroke.id, stroke });
  };

  const beginEraseSwipe = (e) => {
    if (!isLayerVisible(activeLayerId)) return;
    erasingRef.current = { activeIds: new Set() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const extendEraseSwipe = (e) => {
    const swipe = erasingRef.current;
    if (!swipe) return;
    const w = eventToWorld(e);
    if (!w) return;
    const radius = eraserSize / 2;
    let changed = false;
    // Eraser respects the active layer — only strokes on that layer can be hit.
    for (const s of map.strokes || []) {
      const sLayer = s.layerId || 'terrain';
      if (sLayer !== activeLayerId) continue;
      if (swipe.activeIds.has(s.id)) continue;
      if (strokeIntersectsPoint(s, w.x, w.y, radius)) {
        swipe.activeIds.add(s.id);
        changed = true;
      }
    }
    if (changed) setPendingErase(new Set(swipe.activeIds));
  };

  const endEraseSwipe = () => {
    const swipe = erasingRef.current;
    erasingRef.current = null;
    if (!swipe || swipe.activeIds.size === 0) {
      setPendingErase(new Set());
      return;
    }
    const removed = (map.strokes || []).filter(s => swipe.activeIds.has(s.id));
    const remaining = (map.strokes || []).filter(s => !swipe.activeIds.has(s.id));
    updateMapMeta(map.id, { strokes: remaining });
    pushOp({ type: 'delete', strokes: removed });
    setPendingErase(new Set());
  };

  // ── Stamp ops ──────────────────────────────────────────────────────────────
  const placeStamp = (norm) => {
    if (!norm) return;
    if (!isLayerVisible('stamps')) return; // can't place on hidden layer
    
    // Apply snap to grid if enabled
    let { x, y } = norm;
    if (snapToGrid) {
      const cellW = GRID_CELL / effectiveSize.w;
      const cellH = GRID_CELL / effectiveSize.h;
      x = Math.round(x / cellW) * cellW;
      y = Math.round(y / cellH) * cellH;
    }
    
    let stampData;
    if (selectedStamp.source === 'library' && selectedStamp.key) {
      stampData = { libraryPath: selectedStamp.key };
    } else if (selectedStamp.source === 'builtin') {
      stampData = { kind: selectedStamp.key };
    } else {
      stampData = { customId: selectedStamp.key };
    }
    const stamp = {
      id: uuidv4(),
      x,
      y,
      size: selectedStampSize,
      rotation: stampRotation,
      flipX: stampFlipX,
      flipY: stampFlipY,
      ...stampData,
    };
    const newStamps = [...(map.stamps || []), stamp];
    updateMapMeta(map.id, { stamps: newStamps });
    pushOp({ type: 'add-stamp', stamp });
  };

  // Generic patch helper reserved for stamp rotation / flip (wired when UI lands).

  const removeStamp = (stampId) => {
    const removed = (map.stamps || []).find(s => s.id === stampId);
    if (!removed) return;
    const remaining = (map.stamps || []).filter(s => s.id !== stampId);
    updateMapMeta(map.id, { stamps: remaining });
    pushOp({ type: 'delete-stamp', stamp: removed });
  };

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const doUndo = () => {
    setUndoStack(stack => {
      if (!stack.length || !map) return stack;
      const op = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      if (op.type === 'add') {
        const remaining = (map.strokes || []).filter(s => s.id !== op.strokeId);
        updateMapMeta(map.id, { strokes: remaining });
      } else if (op.type === 'delete') {
        const restored = [...(map.strokes || []), ...op.strokes];
        updateMapMeta(map.id, { strokes: restored });
      } else if (op.type === 'clear') {
        updateMapMeta(map.id, { strokes: op.strokes });
      } else if (op.type === 'add-stamp') {
        const remaining = (map.stamps || []).filter(s => s.id !== op.stamp.id);
        updateMapMeta(map.id, { stamps: remaining });
      } else if (op.type === 'delete-stamp') {
        const restored = [...(map.stamps || []), op.stamp];
        updateMapMeta(map.id, { stamps: restored });
      } else if (op.type === 'move-stamp') {
        const newStamps = (map.stamps || []).map(s =>
          s.id === op.stampId ? { ...s, x: op.from.x, y: op.from.y } : s
        );
        updateMapMeta(map.id, { stamps: newStamps });
      } else if (op.type === 'patch-stamp') {
        const newStamps = (map.stamps || []).map(s =>
          s.id === op.stampId ? { ...s, ...op.from } : s
        );
        updateMapMeta(map.id, { stamps: newStamps });
      }
      setRedoStack(r => [...r, op]);
      return newStack;
    });
  };

  const doRedo = () => {
    setRedoStack(stack => {
      if (!stack.length || !map) return stack;
      const op = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      if (op.type === 'add') {
        const restored = [...(map.strokes || []), op.stroke];
        updateMapMeta(map.id, { strokes: restored });
      } else if (op.type === 'delete') {
        const ids = new Set(op.strokes.map(s => s.id));
        const remaining = (map.strokes || []).filter(s => !ids.has(s.id));
        updateMapMeta(map.id, { strokes: remaining });
      } else if (op.type === 'clear') {
        updateMapMeta(map.id, { strokes: [] });
      } else if (op.type === 'add-stamp') {
        const restored = [...(map.stamps || []), op.stamp];
        updateMapMeta(map.id, { stamps: restored });
      } else if (op.type === 'delete-stamp') {
        const remaining = (map.stamps || []).filter(s => s.id !== op.stamp.id);
        updateMapMeta(map.id, { stamps: remaining });
      } else if (op.type === 'move-stamp') {
        const newStamps = (map.stamps || []).map(s =>
          s.id === op.stampId ? { ...s, x: op.to.x, y: op.to.y } : s
        );
        updateMapMeta(map.id, { stamps: newStamps });
      } else if (op.type === 'patch-stamp') {
        const newStamps = (map.stamps || []).map(s =>
          s.id === op.stampId ? { ...s, ...op.to } : s
        );
        updateMapMeta(map.id, { stamps: newStamps });
      }
      setUndoStack(u => [...u, op]);
      return newStack;
    });
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

      const meta = e.metaKey || e.ctrlKey;
      
      // Undo/Redo
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
        return;
      }
      
      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); setTool('view'); }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setTool('pen'); }
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setTool('eraser'); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); setTool('stamp'); }
      if (e.key === 'Escape') setTool('view');
      if (e.key === '?' || e.key === '/') { e.preventDefault(); setShowKeyboardHelp(true); }
      
      // Grid shortcuts
      if (e.key === 'g' || e.key === 'G') { e.preventDefault(); setShowGrid(!showGrid); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setSnapToGrid(!snapToGrid); }
      
      // Zoom shortcuts
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(z => clamp(z * 1.2, ZOOM_MIN, ZOOM_MAX)); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(z => clamp(z / 1.2, ZOOM_MIN, ZOOM_MAX)); }
      if (e.key === '0') { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); zoomToFit(); }
      
      // Layer shortcuts (1-4 for quick layer switching)
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const layerIndex = parseInt(e.key) - 1;
        const penLayers = layers.filter(l => l.kind === 'pen');
        if (penLayers[layerIndex]) {
          selectActivePenLayer(penLayers[layerIndex].id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack, redoStack, map, showGrid, snapToGrid, layers]);

  // ── Layer actions ──────────────────────────────────────────────────────────
  // Persisting a layer change uses updateMapMeta. If the map has no layers
  // array yet (legacy maps), we materialize the defaults plus our delta.
  const persistLayers = (next) => updateMapMeta(map.id, { layers: next });

  const toggleLayerVisibility = (layerId) => {
    const next = layers.map(l =>
      l.id === layerId ? { ...l, visible: l.visible === false ? true : false } : l
    );
    persistLayers(next);
  };

  const selectActivePenLayer = (layerId) => {
    setActiveLayerId(layerId);
    const layer = layers.find(l => l.id === layerId);
    if (layer && layer.kind === 'pen') {
      setPenColor(layer.color);
      setPenSize(layer.defaultSize);
      // If the user selects a layer while in view mode, switch them into pen
      // mode so the click is "useful" — same intent the user probably had.
      if (tool === 'view' || tool === 'eraser') setTool('pen');
    }
  };

  // ── Pan / pin / etc. interactions ──────────────────────────────────────────
  const onPointerDownBackground = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (tool === 'pen') {
      beginPenStroke(e);
      return;
    }
    if (tool === 'eraser') {
      beginEraseSwipe(e);
      extendEraseSwipe(e);
      return;
    }
    if (tool === 'addPin') {
      const norm = eventToNorm(e);
      if (norm) setPendingPos(norm);
      return;
    }
    if (tool === 'setProtagonist') {
      const norm = eventToNorm(e);
      if (norm) { setPendingPos(norm); setPickerForProto(true); }
      return;
    }
    if (tool === 'stamp') {
      const norm = eventToNorm(e);
      if (norm) placeStamp(norm);
      return;
    }
    panStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPan: { ...pan },
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMoveBackground = (e) => {
    if (drawingRef.current)  { extendPenStroke(e);   return; }
    if (erasingRef.current)  { extendEraseSwipe(e);  return; }

    if (panStateRef.current) {
      const s = panStateRef.current;
      setPan({
        x: s.startPan.x + (e.clientX - s.startX),
        y: s.startPan.y + (e.clientY - s.startY),
      });
    }
    if (pinDragRef.current) {
      const norm = eventToNorm(e);
      if (norm) {
        pinDragRef.current.ghost = norm;
        setPinGhost({ ...norm, kind: pinDragRef.current.kind, id: pinDragRef.current.id });
      }
    }
  };

  const onPointerUpBackground = (e) => {
    if (drawingRef.current) { endPenStroke();   return; }
    if (erasingRef.current) { endEraseSwipe();  return; }
    
    if (panStateRef.current) {
      try { e.currentTarget.releasePointerCapture(panStateRef.current.pointerId); } catch { /* capture may already be released */ }
      panStateRef.current = null;
    }
    if (pinDragRef.current) {
      const drag = pinDragRef.current;
      pinDragRef.current = null;
      setPinGhost(null);
      if (!drag.ghost) return;
      if (drag.kind === 'pin') {
        const newPins = (map.pins || []).map(p => p.id === drag.id ? { ...p, x: drag.ghost.x, y: drag.ghost.y } : p);
        updateMapMeta(map.id, { pins: newPins });
      } else if (drag.kind === 'protagonist' && map.protagonist) {
        updateMapMeta(map.id, { protagonist: { ...map.protagonist, x: drag.ghost.x, y: drag.ghost.y } });
      } else if (drag.kind === 'stamp') {
        const target = (map.stamps || []).find(s => s.id === drag.id);
        if (target) {
          const newStamps = (map.stamps || []).map(s =>
            s.id === drag.id ? { ...s, x: drag.ghost.x, y: drag.ghost.y } : s
          );
          updateMapMeta(map.id, { stamps: newStamps });
          if (drag.from && (drag.from.x !== drag.ghost.x || drag.from.y !== drag.ghost.y)) {
            pushOp({
              type: 'move-stamp',
              stampId: drag.id,
              from: drag.from,
              to: { x: drag.ghost.x, y: drag.ghost.y },
            });
          }
        }
      }
    }
  };

  const onWheel = (e) => {
    if (!viewportRef.current) return;
    e.preventDefault();
    const r = viewportRef.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);
    const ratio = newZoom / zoom;
    setPan({ x: px - (px - pan.x) * ratio, y: py - (py - pan.y) * ratio });
    setZoom(newZoom);
  };

  // ── Pin interactions ───────────────────────────────────────────────────────
  const beginPinDrag = (e, kind, pinId = null) => {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    let from = null;
    if (kind === 'stamp') {
      const s = (map.stamps || []).find(x => x.id === pinId);
      if (s) from = { x: s.x, y: s.y };
    }
    pinDragRef.current = { kind, id: pinId, ghost: null, from };
  };

  const handlePinClick = (pin) => {
    if (pinGhost) return;
    navigate(`/${pin.entityType}/${pin.entityId}`);
  };

  const removePin = (pinId) => {
    const newPins = (map.pins || []).filter(p => p.id !== pinId);
    updateMapMeta(map.id, { pins: newPins });
  };

  const removeProtagonist = () => updateMapMeta(map.id, { protagonist: null });

  // ── Entity picker callbacks ────────────────────────────────────────────────
  const onPickForPin = (entity) => {
    if (!pendingPos) return;
    const newPin = {
      id: uuidv4(),
      entityId: entity.id,
      entityType: entity._type,
      x: pendingPos.x,
      y: pendingPos.y,
    };
    updateMapMeta(map.id, { pins: [...(map.pins || []), newPin] });
    setPendingPos(null);
    setTool('view');
  };

  const onPickForProtagonist = (entity) => {
    if (!pendingPos) return;
    updateMapMeta(map.id, {
      protagonist: { entityId: entity.id, x: pendingPos.x, y: pendingPos.y },
    });
    setPendingPos(null);
    setPickerForProto(false);
    setTool('view');
  };

  // ── Entity lookup for rendering pin labels & icons ─────────────────────────
  const charactersAll = useWorldStore(s => s.characters);
  const locationsAll  = useWorldStore(s => s.locations);
  const thingsAll     = useWorldStore(s => s.things);
  const loreAll       = useWorldStore(s => s.lore);
  const factionsAll   = useWorldStore(s => s.factions);
  const creaturesAll  = useWorldStore(s => s.creatures);

  const lookupEntity = (entityType, entityId) => {
    const arr =
      entityType === 'characters' ? charactersAll :
      entityType === 'locations'  ? locationsAll  :
      entityType === 'things'     ? thingsAll     :
      entityType === 'lore'       ? loreAll       :
      entityType === 'factions'   ? factionsAll   :
      entityType === 'creatures'  ? creaturesAll  : [];
    return arr.find(e => e.id === entityId) || null;
  };

  const protagonistEntity = map?.protagonist ? lookupEntity('characters', map.protagonist.entityId) : null;

  // ── Custom stamp lookup ────────────────────────────────────────────────────
  const customStampById = useMemo(
    () => Object.fromEntries((customStamps || []).map(s => [s.id, s])),
    [customStamps]
  );

  // ── Stamp picker (filtered list) ───────────────────────────────────────────
  // Build a unified list of choosable stamps, pre-filtered by the search query
  // and selected tag chip. Each entry has a uniform shape so the picker doesn't
  // need to branch in the JSX.
  const allStampTags = useMemo(() => {
    const set = new Set();
    for (const s of STAMP_LIBRARY) (s.tags || []).forEach(t => set.add(t));
    for (const s of (customStamps || [])) (s.tags || []).forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [customStamps]);

  const filteredBuiltins = useMemo(() => {
    const q = stampQuery.trim().toLowerCase();
    return STAMP_LIBRARY.filter(s => {
      if (stampTagFilter && !(s.tags || []).includes(stampTagFilter)) return false;
      if (!q) return true;
      const hay = `${s.label} ${(s.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [stampQuery, stampTagFilter]);

  const filteredCustom = useMemo(() => {
    const q = stampQuery.trim().toLowerCase();
    return (customStamps || []).filter(s => {
      if (stampTagFilter && !(s.tags || []).includes(stampTagFilter)) return false;
      if (!q) return true;
      const hay = `${s.name} ${(s.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [customStamps, stampQuery, stampTagFilter]);

  // Derived "current stamp" for the size-preview thumbnails and the hint banner.
  const currentStampMeta = useMemo(() => {
    if (selectedStamp.source === 'library' && selectedStamp.key) {
      return { kind: 'library', label: selectedStamp.name || 'Stamp', path: selectedStamp.key };
    }
    if (selectedStamp.source === 'builtin') {
      const def = STAMP_BY_KIND[selectedStamp.key];
      return def ? { kind: 'builtin', label: def.label, icon: def.icon, color: def.color } : null;
    }
    const def = customStampById[selectedStamp.key];
    return def ? { kind: 'custom', label: def.name, svg: def.svg } : null;
  }, [selectedStamp, customStampById]);

  // Filtered PNG stamp list for the picker
  const filteredPngStamps = useMemo(() => {
    const q = stampQuery.trim().toLowerCase();
    if (!q) return customPngStamps;
    return customPngStamps.filter(s => s.label.toLowerCase().includes(q));
  }, [customPngStamps, stampQuery]);

  // ── Strokes grouped by layer ───────────────────────────────────────────────
  const strokesByLayerId = useMemo(() => {
    const out = {};
    for (const s of (map?.strokes || [])) {
      const lid = s.layerId || 'terrain';
      if (!out[lid]) out[lid] = [];
      out[lid].push(s);
    }
    return out;
  }, [map?.strokes]);

  // ── Image replace ──────────────────────────────────────────────────────────
  const fileRef = useRef(null);
  const handleReplaceImage = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await saveMap({ ...map, image: ev.target.result });
      setImgLoaded(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearAll = () => {
    if (!map?.strokes?.length) return;
    pushOp({ type: 'clear', strokes: map.strokes });
    updateMapMeta(map.id, { strokes: [] });
    setConfirmClear(false);
  };

  const handleGenerateShape = (shapeType, size, complexity) => {
    // Generate shape in the center of the current view
    const centerX = effectiveSize.w / 2;
    const centerY = effectiveSize.h / 2;
    
    let points;
    if (shapeType === 'coastline') {
      points = generateCoastline(centerX, centerY, size, complexity);
    } else {
      points = generateIslandShape(centerX, centerY, size, complexity, shapeType);
    }
    
    // Create a stroke from the generated points
    const stroke = {
      id: uuidv4(),
      tool: 'pen',
      layerId: 'terrain',
      color: '#1a1a1a',
      size: 4,
      points,
    };
    
    const newStrokes = [...(map.strokes || []), stroke];
    updateMapMeta(map.id, { strokes: newStrokes });
    pushOp({ type: 'add', strokeId: stroke.id, stroke });
    setShowGenerateModal(false);
    
    // Zoom to fit the new shape
    setTimeout(() => zoomToFit(), 100);
  };

  // ── Custom-stamp upload flow ───────────────────────────────────────────────
  const handlePickCustomStampFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      alert('Please select an SVG file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = String(ev.target?.result || '');
      const clean = sanitizeSvg(raw);
      if (!clean.toLowerCase().includes('<svg')) {
        alert("That file doesn't look like a valid SVG.");
        return;
      }
      const initialName = file.name.replace(/\.svg$/i, '');
      setPendingCustomUpload({ initialName, svg: clean });
    };
    reader.readAsText(file);
  };

  const handleSaveCustomStamp = async ({ name, tags, svg }) => {
    const saved = await addCustomStamp({ name, tags, svg });
    setPendingCustomUpload(null);
    if (saved?.id) setSelectedStamp({ source: 'custom', key: saved.id });
  };

  const handleConfirmDeleteCustomStamp = async () => {
    if (!customStampToDelete) return;
    await deleteCustomStamp(customStampToDelete.id);
    if (selectedStamp.source === 'custom' && selectedStamp.key === customStampToDelete.id) {
      setSelectedStamp({ source: 'builtin', key: STAMP_LIBRARY[0].kind });
    }
    setCustomStampToDelete(null);
  };

  // ── PNG stamp library loading (flat list from customStamps/) ────────────────
  const loadCustomPngStamps = useCallback(async () => {
    setStampsLoading(true);
    try {
      const passcode = localStorage.getItem('passcode') || '';
      const res = await fetch('/api/stamps/list', { headers: { 'X-Passcode': passcode } });
      if (!res.ok) { setCustomPngStamps([]); return; }
      const data = await res.json();
      setCustomPngStamps(data.stamps || []);
      // Auto-select the first stamp if nothing is selected yet
      if (data.stamps?.length > 0 && !selectedStamp.key) {
        const first = data.stamps[0];
        setSelectedStamp({ source: 'library', key: first.rel, name: first.label });
      }
    } catch (err) {
      console.error('Failed to load PNG stamps:', err);
      setCustomPngStamps([]);
    } finally {
      setStampsLoading(false);
    }
  }, [selectedStamp.key]);

  // Load on mount
  useEffect(() => {
    loadCustomPngStamps();
  }, []);

  const handleSelectPngStamp = (stamp) => {
    setSelectedStamp({ source: 'library', key: stamp.rel, name: stamp.label });
  };

  // ── Early-return for missing map (after all hooks) ─────────────────────────
  if (!map) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <MapIcon size={36} className="text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground mb-4">Map not found.</p>
        <button onClick={() => navigate('/maps')} className="text-sm text-primary hover:underline">
          Back to maps
        </button>
      </div>
    );
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  const cursorClass =
    tool === 'pen'            ? 'cursor-crosshair' :
    tool === 'eraser'         ? 'cursor-cell'      :
    showHistory              ? 'cursor-default'   :
    tool === 'addPin'         ? 'cursor-crosshair' :
    tool === 'setProtagonist' ? 'cursor-crosshair' :
                                'cursor-grab';

  const drawingActive = tool === 'pen' || tool === 'eraser';
  const stampActive = tool === 'stamp';
  const subPanelActive = drawingActive || stampActive;

  // Background paper color
  const paperColor = map.paperColor || (map.image ? null : '#0b1020');

  const stampsVisible = isLayerVisible('stamps');
  const pinsVisible = isLayerVisible('pins');

  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top toolbar */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
          <button
            onClick={() => navigate('/maps')}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Back to maps"
          >
            <ArrowLeft size={16} />
          </button>

          {renaming ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const next = draftName.trim();
                if (next && next !== map.name) await updateMapMeta(map.id, { name: next });
                setRenaming(false);
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={async () => {
                  const next = draftName.trim();
                  if (next && next !== map.name) await updateMapMeta(map.id, { name: next });
                  setRenaming(false);
                }}
                className="bg-secondary text-foreground text-base font-semibold rounded px-2 py-1 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="submit" className="p-1 rounded text-muted-foreground hover:text-foreground"><Check size={14} /></button>
            </form>
          ) : (
            <button
              onClick={() => { setDraftName(map.name || ''); setRenaming(true); }}
              className="text-base font-semibold text-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded flex items-center gap-1.5 group"
              title="Rename map"
            >
              {map.name || 'Untitled map'}
              <Pencil size={11} className="text-muted-foreground/50 group-hover:text-muted-foreground" />
            </button>
          )}

          <div className="flex-1" />

          {/* Undo / Redo — prominently in the top toolbar so they're always one click away */}
          <button
            onClick={doUndo}
            disabled={undoStack.length === 0}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Undo (⌘Z)"
          >
            <Undo2 size={13} /> Undo
          </button>
          <button
            onClick={doRedo}
            disabled={redoStack.length === 0}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={13} /> Redo
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium border transition-colors ${showHistory ? 'bg-secondary border-primary' : 'border-border text-foreground hover:bg-secondary'}`}
            title="History"
          >
            <span className="text-[10px]">{undoStack.length + redoStack.length}</span>
          </button>

          <span className="mx-2 h-6 w-px bg-border" />

          {/* Zoom controls */}
          <button
            onClick={() => {
              const r = viewportRef.current?.getBoundingClientRect();
              if (!r) return;
              const cx = r.width / 2, cy = r.height / 2;
              const newZoom = clamp(zoom / 1.25, ZOOM_MIN, ZOOM_MAX);
              const ratio = newZoom / zoom;
              setPan({ x: cx - (cx - pan.x) * ratio, y: cy - (cy - pan.y) * ratio });
              setZoom(newZoom);
            }}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => {
              const r = viewportRef.current?.getBoundingClientRect();
              if (!r) return;
              const cx = r.width / 2, cy = r.height / 2;
              const newZoom = clamp(zoom * 1.25, ZOOM_MIN, ZOOM_MAX);
              const ratio = newZoom / zoom;
              setPan({ x: cx - (cx - pan.x) * ratio, y: cy - (cy - pan.y) * ratio });
              setZoom(newZoom);
            }}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={fitToView}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Fit to view"
          >
            <Maximize size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowGrid(g => !g)}
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
              showGrid ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            title={showGrid ? 'Hide alignment grid' : 'Show alignment grid'}
          >
            <Grid3x3 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSnapToGrid(g => !g)}
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
              snapToGrid ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            title={snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
          >
            <AlignCenter size={14} />
          </button>
          <button
            type="button"
            onClick={zoomToFit}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Zoom to fit all content"
          >
            <Maximize size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowMinimap(!showMinimap)}
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${showMinimap ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            title="Toggle minimap"
          >
            <Ruler size={14} />
          </button>

          <span className="mx-2 h-6 w-px bg-border" />

          <button
            onClick={() => setShowKeyboardHelp(true)}
            className="h-8 px-2 flex items-center gap-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs"
            title="Keyboard shortcuts (press ?)"
          >
            <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-secondary border border-border">?</span>
            Shortcuts
          </button>

          <span className="mx-2 h-6 w-px bg-border" />

          <button
            onClick={() => setShowGenerateModal(true)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs font-medium"
            title="Generate island or region shape"
          >
            <Sparkles size={13} /> Generate
          </button>
          <button
            onClick={exportMapAsPng}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Export as PNG"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => setDeletingMap(true)}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete map"
          >
            <Trash2 size={14} />
          </button>
        </header>

        {/* Mode hint banner */}
        {(tool === 'addPin' || tool === 'setProtagonist' || tool === 'stamp') && (
          <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-xs text-primary flex items-center gap-2">
            {tool === 'addPin' && <Pin size={12} />}
            {tool === 'setProtagonist' && <Star size={12} />}
            {tool === 'stamp' && <StampIcon size={12} />}
            {tool === 'addPin' && 'Click anywhere on the map to drop a pin, then choose an entity.'}
            {tool === 'setProtagonist' && 'Click anywhere on the map to place the protagonist marker, then choose a character.'}
            {tool === 'stamp' && (currentStampMeta
              ? `Click anywhere on the map to drop a ${currentStampMeta.label.toLowerCase()}. Pick a different one from the panel.`
              : 'Click anywhere on the map to drop a stamp.')}
            <button onClick={() => { setTool('view'); setPendingPos(null); }} className="ml-auto text-primary/70 hover:text-primary">
              Done
            </button>
          </div>
        )}

        {/* Viewport (with floating left palette + right layer panel) */}
        <div className="relative flex-1 overflow-hidden">
          {/* Left tool palette */}
          <div className="absolute top-3 left-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-1.5 flex flex-col gap-1">
            <ToolButton active={tool === 'view'}    onClick={() => setTool('view')}    title="Hand / Pan (V)">
              <Hand size={15} />
            </ToolButton>
            <div className="h-px bg-border my-0.5" />
            <ToolButton active={tool === 'pen'}     onClick={() => setTool('pen')}     title="Pen (P)">
              <Pencil size={15} />
            </ToolButton>
            <ToolButton active={tool === 'eraser'}  onClick={() => setTool('eraser')}  title="Eraser (E)">
              <Eraser size={15} />
            </ToolButton>
            <ToolButton active={tool === 'stamp'}   onClick={() => setTool('stamp')}   title="Stamps (S)">
              <StampIcon size={15} />
            </ToolButton>
            <div className="h-px bg-border my-0.5" />
            <ToolButton active={tool === 'addPin'}  onClick={() => setTool(tool === 'addPin' ? 'view' : 'addPin')} title="Add Pin">
              <Pin size={15} />
            </ToolButton>
            <ToolButton
              active={tool === 'setProtagonist'}
              onClick={() => setTool(tool === 'setProtagonist' ? 'view' : 'setProtagonist')}
              title={map.protagonist ? 'Move protagonist marker' : 'Set protagonist marker'}
            >
              <Star size={15} />
            </ToolButton>
            {map.protagonist && (
              <ToolButton onClick={removeProtagonist} title="Clear protagonist marker" danger>
                <X size={14} />
              </ToolButton>
            )}
            {(map.strokes?.length || 0) > 0 && (
              <>
                <div className="h-px bg-border my-0.5" />
                <ToolButton onClick={() => setConfirmClear(true)} title="Clear all strokes" danger>
                  <Trash2 size={15} />
                </ToolButton>
              </>
            )}
          </div>

          {/* Pen / eraser / stamp sub-controls appear when relevant */}
          {subPanelActive && (
            <div className={`absolute top-3 left-[68px] z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 flex flex-col gap-2 ${stampActive ? 'w-72' : 'w-44'}`}>
              {tool === 'pen' && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                    <span>Drawing on</span>
                    <span className="text-foreground normal-case font-medium">{layerById[activeLayerId]?.name || 'Terrain'}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Color</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PEN_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setPenColor(c)}
                          className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${penColor === c ? 'border-primary' : 'border-border'}`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={penColor}
                      onChange={e => setPenColor(e.target.value)}
                      className="mt-2 w-full h-7 rounded cursor-pointer bg-transparent border border-border"
                      title="Custom color"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Size</p>
                    <div className="flex items-center gap-1">
                      {PEN_SIZES.map(s => (
                        <button
                          key={s}
                          onClick={() => setPenSize(s)}
                          className={`flex-1 h-8 rounded border flex items-center justify-center transition-colors ${penSize === s ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'}`}
                          title={`${s}px`}
                        >
                          <span
                            className="rounded-full"
                            style={{ width: Math.min(s, 16), height: Math.min(s, 16), backgroundColor: penColor }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {tool === 'eraser' && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                    <span>Erasing on</span>
                    <span className="text-foreground normal-case font-medium">{layerById[activeLayerId]?.name || 'Terrain'}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Eraser size</p>
                    <div className="flex items-center gap-1">
                      {ERASER_SIZES.map(s => (
                        <button
                          key={s}
                          onClick={() => setEraserSize(s)}
                          className={`flex-1 h-8 rounded border flex items-center justify-center transition-colors ${eraserSize === s ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'}`}
                          title={`${s}px`}
                        >
                          <span className="rounded-full bg-muted-foreground" style={{ width: s / 2, height: s / 2 }} />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {tool === 'stamp' && (
                <>
                  {/* Search */}
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={stampQuery}
                      onChange={e => setStampQuery(e.target.value)}
                      placeholder="Search stamps…"
                      className="w-full bg-secondary text-foreground text-xs rounded-md pl-7 pr-2 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Stamp grid */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Images ({filteredPngStamps.length})
                      </p>
                      <button
                        onClick={loadCustomPngStamps}
                        title="Refresh stamp list"
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ↺
                      </button>
                    </div>

                    {stampsLoading ? (
                      <p className="text-[11px] text-muted-foreground p-3 text-center">Loading…</p>
                    ) : filteredPngStamps.length === 0 ? (
                      <div className="text-center py-4 space-y-1.5">
                        <p className="text-[11px] text-muted-foreground/70">
                          {customPngStamps.length === 0
                            ? 'Drop PNG files into customStamps/ to get started'
                            : 'No stamps match your search'}
                        </p>
                        {customPngStamps.length === 0 && (
                          <p className="text-[10px] text-muted-foreground/50">
                            Supports PNG, JPG, SVG, WEBP
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1 max-h-52 overflow-y-auto pr-0.5">
                        {filteredPngStamps.map(s => {
                          const active = selectedStamp.source === 'library' && selectedStamp.key === s.rel;
                          return (
                            <button
                              key={s.rel}
                              onClick={() => handleSelectPngStamp(s)}
                              title={s.label}
                              className={`aspect-square rounded border flex flex-col items-center justify-center gap-0.5 transition-colors p-1 ${
                                active ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'
                              }`}
                            >
                              <img
                                src={`/api/stamps/image?path=${encodeURIComponent(s.rel)}`}
                                alt={s.label}
                                draggable={false}
                                style={{ maxWidth: '100%', maxHeight: 36, display: 'block', objectFit: 'contain' }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selected name */}
                  {currentStampMeta && (
                    <p className="text-[10px] text-muted-foreground text-center capitalize border-t border-border pt-1.5">
                      {currentStampMeta.label}
                    </p>
                  )}

                  {/* Size */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Size</p>
                    <div className="flex items-center gap-1">
                      {STAMP_SIZES.map(sz => {
                        const active = selectedStampSize === sz;
                        const previewSize = Math.min(sz / 2.5, 18);
                        return (
                          <button
                            key={sz}
                            onClick={() => setSelectedStampSize(sz)}
                            className={`flex-1 h-8 rounded border flex items-center justify-center transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'}`}
                            title={`${sz}px`}
                          >
                            {currentStampMeta?.kind === 'library' && currentStampMeta.path ? (
                              <img
                                src={`/api/stamps/image?path=${encodeURIComponent(currentStampMeta.path)}`}
                                alt=""
                                draggable={false}
                                style={{ maxWidth: previewSize, maxHeight: previewSize, display: 'block', objectFit: 'contain' }}
                              />
                            ) : (
                              <StampIcon size={previewSize} className="text-muted-foreground" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Custom size input */}
                    <div className="mt-1.5 flex items-center gap-1">
                      <input
                        type="number"
                        value={customSizeInput}
                        onChange={(e) => setCustomSizeInput(e.target.value)}
                        onBlur={() => {
                          const val = parseInt(customSizeInput, 10);
                          if (val > 0 && val <= 500) setSelectedStampSize(val);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                        placeholder="Custom"
                        className="w-14 bg-secondary text-foreground text-xs rounded-md px-2 py-1 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-[10px] text-muted-foreground">px</span>
                    </div>
                  </div>

                  {/* Transform controls */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Transform</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setStampRotation((stampRotation + 90) % 360)}
                        className="flex-1 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center transition-colors"
                        title="Rotate 90°"
                      >
                        <RotateCw size={14} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setStampFlipX(!stampFlipX)}
                        className={`flex-1 h-8 rounded border flex items-center justify-center transition-colors ${stampFlipX ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'}`}
                        title="Flip horizontal"
                      >
                        <FlipHorizontal size={14} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setStampFlipY(!stampFlipY)}
                        className={`flex-1 h-8 rounded border flex items-center justify-center transition-colors ${stampFlipY ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'}`}
                        title="Flip vertical"
                      >
                        <FlipVertical size={14} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { setStampRotation(0); setStampFlipX(false); setStampFlipY(false); }}
                        className="flex-1 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center transition-colors text-[10px]"
                        title="Reset transform"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* History panel */}
          {showHistory && (
            <aside className="absolute top-3 right-3 z-20 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg w-64 max-h-80 overflow-hidden flex flex-col">
              <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-border">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">History</span>
                <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-1">
                {[...undoStack].reverse().map((op, idx) => (
                  <div
                    key={`undo-${idx}`}
                    onClick={() => {
                      // Step back to this state
                      while (undoStack.length > idx + 1) doUndo();
                    }}
                    className="text-xs px-2 py-1 rounded hover:bg-secondary cursor-pointer flex items-center gap-1"
                  >
                    <Undo2 size={10} className="text-muted-foreground" />
                    <span className="text-muted-foreground">{getOpLabel(op)}</span>
                  </div>
                ))}
                {redoStack.length > 0 && <div className="border-t border-border my-1" />}
                {redoStack.map((op, idx) => (
                  <div
                    key={`redo-${idx}`}
                    onClick={() => {
                      // Redo up to this point
                      while (redoStack.length > idx + 1) doRedo();
                    }}
                    className="text-xs px-2 py-1 rounded hover:bg-secondary cursor-pointer flex items-center gap-1"
                  >
                    <Redo2 size={10} className="text-muted-foreground" />
                    <span>{getOpLabel(op)}</span>
                  </div>
                ))}
                {undoStack.length === 0 && redoStack.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">No history yet</p>
                )}
              </div>
            </aside>
          )}

          {/* Right Layers panel */}
          {!showHistory && (
          <aside className="absolute top-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg w-52">
            <header className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border">
              <LayersIcon size={12} className="text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Layers</span>
            </header>
            <div className="p-1 flex flex-col gap-0.5">
              {layers
                .filter(l => l.kind === 'pen')
                .map((layer, idx, arr) => (
                  <LayerRow
                    key={layer.id}
                    layer={layer}
                    active={activeLayerId === layer.id}
                    onClickActivate={() => selectActivePenLayer(layer.id)}
                    onToggleVisibility={() => toggleLayerVisibility(layer.id)}
                    onDelete={() => deleteLayer(layer.id)}
                    onRename={(name) => renameLayer(layer.id, name)}
                    onMoveUp={() => moveLayer(layer.id, 'up')}
                    onMoveDown={() => moveLayer(layer.id, 'down')}
                    canDelete={layer.id !== 'terrain' && layer.id !== 'rivers' && layer.id !== 'roads' && layer.id !== 'annotations'}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < arr.length - 1}
                    editing={editingLayerId === layer.id}
                    editingName={editingLayerName}
                    onStartEdit={() => { setEditingLayerId(layer.id); setEditingLayerName(layer.name); }}
                    onCancelEdit={() => setEditingLayerId(null)}
                    onSaveEdit={(name) => { renameLayer(layer.id, name); setEditingLayerId(null); }}
                  />
                ))}
              <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border mt-1">
                <span className="text-[10px] text-muted-foreground flex-1">Special layers</span>
              </div>
              {layerById['stamps'] && (
                <div className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/60">
                  <button onClick={() => toggleLayerVisibility('stamps')} className="text-muted-foreground hover:text-foreground">
                    {layerById['stamps'].visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <StampIcon size={12} className="text-muted-foreground" />
                  <span className="text-xs text-foreground/85">Stamps</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{map?.stamps?.length || 0}</span>
                </div>
              )}
              {layerById['pins'] && (
                <div className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/60">
                  <button onClick={() => toggleLayerVisibility('pins')} className="text-muted-foreground hover:text-foreground">
                    {layerById['pins'].visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <Pin size={12} className="text-muted-foreground" />
                  <span className="text-xs text-foreground/85">Pins</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{map?.pins?.length || 0}</span>
                </div>
              )}
              {addingLayer ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    autoFocus
                    value={newLayerName}
                    onChange={(e) => setNewLayerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' ? addNewLayer() : e.key === 'Escape' ? setAddingLayer(false) : null}
                    placeholder="Layer name"
                    className="flex-1 bg-secondary text-foreground text-xs rounded px-2 py-1 border border-border focus:outline-none"
                  />
                  <button onClick={addNewLayer} className="text-primary hover:text-primary/80"><Check size={12} /></button>
                  <button onClick={() => setAddingLayer(false)} className="text-muted-foreground hover:text-foreground"><X size={12} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingLayer(true)}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded transition-colors"
                >
                  <Plus size={10} /> Add layer
                </button>
              )}
            </div>
            <p className="px-2.5 pb-2 pt-1 text-[10px] text-muted-foreground/70 leading-relaxed border-t border-border">
              Click a pen layer to draw on it. Eye toggles visibility. Use the toolbar grid icon for alignment lines. New blank maps open on an 8192×8192 workspace; maps that already have pins or strokes stay on the classic 2000×1500 canvas so markers stay put.
            </p>
          </aside>
          )}

          {/* Drawing/viewport surface */}
          <div
            ref={viewportRef}
            className={`relative w-full h-full overflow-hidden ${cursorClass}`}
            style={{
              backgroundColor: '#0a0a0a',
              touchAction: 'none',
            }}
            onPointerDown={onPointerDownBackground}
            onPointerMove={onPointerMoveBackground}
            onPointerUp={onPointerUpBackground}
            onPointerCancel={onPointerUpBackground}
            onWheel={onWheel}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                userSelect: 'none',
                willChange: 'transform',
              }}
            >
              {/* Paper background — only when there is no image or image failed to load */}
              {(!map.image || !imgLoaded) && paperColor && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: effectiveSize.w,
                    height: effectiveSize.h,
                    backgroundColor: paperColor,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.25), 0 16px 48px rgba(0,0,0,0.5)',
                  }}
                />
              )}

              {map.image && (
                <img
                  ref={imgRef}
                  src={map.image}
                  alt={map.name || 'Map'}
                  draggable={false}
                  onLoad={(e) => {
                    setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
                    setImgLoaded(true);
                  }}
                  onError={() => {
                    // Hide broken images
                    setImgLoaded(false);
                    setImgSize({ w: 0, h: 0 });
                  }}
                  style={{
                    display: imgLoaded ? 'block' : 'none',
                    maxWidth: 'none',
                    ...(imgLoaded && imgSize.w > 0 ? { width: imgSize.w, height: imgSize.h } : {}),
                  }}
                />
              )}

              {showGrid && effectiveSize.w > 0 && map?.id && (
                <svg
                  aria-hidden
                  className="map-svg-export"
                  width={effectiveSize.w}
                  height={effectiveSize.h}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  <defs>
                    <pattern
                      id={`wb-grid-${map.id}`}
                      width={GRID_CELL}
                      height={GRID_CELL}
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d={`M ${GRID_CELL} 0 L 0 0 0 ${GRID_CELL}`}
                        fill="none"
                        stroke="rgba(148,163,184,0.14)"
                        strokeWidth={1}
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#wb-grid-${map.id})`} />
                </svg>
              )}

              {/* Drawing layers */}
              {effectiveSize.w > 0 && (
                <svg
                  width={effectiveSize.w}
                  height={effectiveSize.h}
                  viewBox={`0 0 ${effectiveSize.w} ${effectiveSize.h}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none',
                    overflow: 'visible',
                    zIndex: 2,
                  }}
                >
                  {/* Render strokes bottom → top in DEFAULT_LAYERS order, hidden layers omitted. */}
                  {PEN_LAYER_ORDER.map(layerId => {
                    if (!isLayerVisible(layerId)) return null;
                    const list = strokesByLayerId[layerId] || [];
                    if (list.length === 0) return null;
                    return (
                      <g key={layerId}>
                        {list.filter(s => !pendingErase.has(s.id)).map(s => (
                          <path
                            key={s.id}
                            d={pointsToPathD(s.points)}
                            stroke={s.color}
                            strokeWidth={s.size}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                      </g>
                    );
                  })}
                  {/* Faded preview of strokes that will be deleted on pointer-up */}
                  {(map.strokes || []).filter(s => pendingErase.has(s.id) && isLayerVisible(s.layerId || 'terrain')).map(s => (
                    <path
                      key={s.id + '-pending'}
                      d={pointsToPathD(s.points)}
                      stroke={s.color}
                      strokeWidth={s.size}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.18 }}
                    />
                  ))}
                  {/* In-progress stroke (pen). */}
                  {isDrawing && (
                    <path
                      ref={livePathRef}
                      stroke={penColor}
                      strokeWidth={penSize}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              )}

              {/* Stamps */}
              {effectiveSize.w > 0 && stampsVisible && (map.stamps || []).map(stamp => {
                let stampInner;
                if (stamp.kind) {
                  const def = STAMP_BY_KIND[stamp.kind];
                  if (!def) return null;
                  const Icon = def.icon;
                  const color = stamp.colorTint || stamp.color || def.color;
                  stampInner = <Icon size={stamp.size || DEFAULT_STAMP_SIZE} style={{ color, display: 'block' }} strokeWidth={1.6} />;
                } else if (stamp.libraryPath) {
                  // Library stamps from filesystem (PNG, SVG, etc.)
                  const imgStyle = { 
                    width: '100%', 
                    height: '100%', 
                    display: 'block',
                    objectFit: 'contain',
                    transform: `scaleX(${stamp.flipX ? -1 : 1}) scaleY(${stamp.flipY ? -1 : 1})`,
                  };
                  stampInner = (
                    <img
                      src={`/api/stamps/image?path=${encodeURIComponent(stamp.libraryPath)}`}
                      alt="Stamp"
                      draggable={false}
                      style={imgStyle}
                    />
                  );
                } else if (stamp.customId) {
                  const def = customStampById[stamp.customId];
                  if (!def) return null; // stamp references a deleted custom — silently hide
                  stampInner = (
                    <img
                      src={svgToDataUri(def.svg)}
                      alt={def.name}
                      draggable={false}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'block',
                        filter: stamp.colorTint ? `sepia(1) hue-rotate(${getHueRotation(stamp.colorTint)}) saturate(${getSaturation(stamp.colorTint)})` : 'none',
                        transform: `scaleX(${stamp.flipX ? -1 : 1}) scaleY(${stamp.flipY ? -1 : 1})`,
                      }}
                    />
                  );
                } else {
                  return null;
                }

                const isDragGhost = pinGhost && pinGhost.kind === 'stamp' && pinGhost.id === stamp.id;
                const sx = (isDragGhost ? pinGhost.x : stamp.x) * effectiveSize.w;
                const sy = (isDragGhost ? pinGhost.y : stamp.y) * effectiveSize.h;
                const size = stamp.size || DEFAULT_STAMP_SIZE;
                const interactive = tool !== 'stamp';
                const stampPointerEvents = mapToolsNeedViewportHits ? 'none' : interactive ? 'auto' : 'none';
                return (
                  <div
                    key={stamp.id}
                    onPointerDown={interactive ? (e) => beginPinDrag(e, 'stamp', stamp.id) : undefined}
                    onMouseEnter={interactive ? () => setHoveredStampId(stamp.id) : undefined}
                    onMouseLeave={interactive ? () => setHoveredStampId(prev => prev === stamp.id ? null : prev) : undefined}
                    style={{
                      position: 'absolute',
                      left: sx,
                      top: sy,
                      width: size,
                      height: size,
                      transform: 'translate(-50%, -50%)',
                      cursor: interactive ? (tool === 'view' ? 'grab' : 'pointer') : 'crosshair',
                      pointerEvents: stampPointerEvents,
                      zIndex: 3,
                    }}
                  >
                    {stampInner}
                  </div>
                );
              })}

              {/* Pins inside the transform so they scale with the map */}
              {effectiveSize.w > 0 && pinsVisible && (map.pins || []).map(pin => {
                const ent = lookupEntity(pin.entityType, pin.entityId);
                if (!ent) return null;
                const meta = TYPE_META[pin.entityType] || TYPE_META.things;
                const isDragGhost = pinGhost && pinGhost.kind === 'pin' && pinGhost.id === pin.id;
                const px = (isDragGhost ? pinGhost.x : pin.x) * effectiveSize.w;
                const py = (isDragGhost ? pinGhost.y : pin.y) * effectiveSize.h;
                return (
                  <div
                    key={pin.id}
                    onPointerDown={(e) => beginPinDrag(e, 'pin', pin.id)}
                    onClick={() => handlePinClick(pin)}
                    onMouseEnter={() => setHoveredPin(pin.id)}
                    onMouseLeave={() => setHoveredPin(prev => prev === pin.id ? null : prev)}
                    style={{
                      position: 'absolute',
                      left: px,
                      top: py,
                      transform: 'translate(-50%, -100%)',
                      cursor: 'pointer',
                      pointerEvents: mapToolsNeedViewportHits ? 'none' : 'auto',
                      zIndex: 4,
                    }}
                  >
                    <PinMarker color={meta.color} Icon={meta.icon} isProtagonist={false} />
                  </div>
                );
              })}

              {effectiveSize.w > 0 && pinsVisible && map.protagonist && protagonistEntity && (() => {
                const isDragGhost = pinGhost && pinGhost.kind === 'protagonist';
                const px = (isDragGhost ? pinGhost.x : map.protagonist.x) * effectiveSize.w;
                const py = (isDragGhost ? pinGhost.y : map.protagonist.y) * effectiveSize.h;
                return (
                  <div
                    onPointerDown={(e) => beginPinDrag(e, 'protagonist')}
                    onClick={() => !pinGhost && navigate(`/characters/${map.protagonist.entityId}`)}
                    onMouseEnter={() => setHoveredPin('__protagonist__')}
                    onMouseLeave={() => setHoveredPin(prev => prev === '__protagonist__' ? null : prev)}
                    style={{
                      position: 'absolute',
                      left: px,
                      top: py,
                      transform: 'translate(-50%, -100%)',
                      cursor: 'pointer',
                      pointerEvents: mapToolsNeedViewportHits ? 'none' : 'auto',
                      zIndex: 4,
                    }}
                  >
                    <PinMarker color={PROTAGONIST_COLOR} Icon={Star} isProtagonist />
                  </div>
                );
              })()}
            </div>

            {/* Hover tooltip overlay (rendered in viewport space, NOT scaled) */}
            {hoveredPin && pinsVisible && effectiveSize.w > 0 && (() => {
              let pin, entity, color, isProto = false;
              if (hoveredPin === '__protagonist__' && map.protagonist) {
                pin = map.protagonist;
                entity = protagonistEntity;
                color = PROTAGONIST_COLOR;
                isProto = true;
              } else {
                pin = (map.pins || []).find(p => p.id === hoveredPin);
                if (!pin) return null;
                entity = lookupEntity(pin.entityType, pin.entityId);
                color = (TYPE_META[pin.entityType] || TYPE_META.things).color;
              }
              if (!entity) return null;
              const sx = pin.x * effectiveSize.w * zoom + pan.x;
              const sy = pin.y * effectiveSize.h * zoom + pan.y;
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: sx,
                    top: sy - 50,
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'none',
                  }}
                  className="bg-card border border-border rounded-md shadow-lg px-3 py-1.5 text-xs whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-semibold text-foreground">{entity.name}</span>
                  </div>
                  <div className="text-muted-foreground capitalize">
                    {isProto ? 'Protagonist' : (TYPE_META[pin.entityType]?.label || pin.entityType)}
                  </div>
                </div>
              );
            })()}

            {/* Bottom-left status badge */}
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm border border-border rounded-md px-2.5 py-1 text-xs text-muted-foreground flex items-center gap-2 pointer-events-none">
              <span className="flex items-center gap-1"><Pin size={11} /> {(map.pins?.length || 0)}</span>
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-1"><StampIcon size={11} /> {(map.stamps?.length || 0)}</span>
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-1"><Pencil size={11} /> {(map.strokes?.length || 0)}</span>
              {map.protagonist && (
                <>
                  <span className="opacity-40">·</span>
                  <Star size={11} className="text-yellow-400" />
                </>
              )}
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-1"><LayersIcon size={11} /> {layerById[activeLayerId]?.name || 'Terrain'}</span>
            </div>

            {/* Hover-stamp delete X */}
            {hoveredStampId && stampsVisible && effectiveSize.w > 0 && (() => {
              const stamp = (map.stamps || []).find(s => s.id === hoveredStampId);
              if (!stamp) return null;
              const sx = stamp.x * effectiveSize.w * zoom + pan.x;
              const sy = stamp.y * effectiveSize.h * zoom + pan.y;
              const half = ((stamp.size || DEFAULT_STAMP_SIZE) * zoom) / 2;
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); removeStamp(stamp.id); setHoveredStampId(null); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseEnter={() => setHoveredStampId(stamp.id)}
                  onMouseLeave={() => setHoveredStampId(prev => prev === stamp.id ? null : prev)}
                  style={{
                    position: 'absolute',
                    left: sx + half - 6,
                    top: sy - half - 6,
                    pointerEvents: 'auto',
                  }}
                  className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-md"
                  title="Remove stamp"
                >
                  <X size={11} strokeWidth={3} />
                </button>
              );
            })()}

            {/* Hover-pin context controls */}
            {hoveredPin && hoveredPin !== '__protagonist__' && pinsVisible && effectiveSize.w > 0 && (() => {
              const pin = (map.pins || []).find(p => p.id === hoveredPin);
              if (!pin) return null;
              const sx = pin.x * effectiveSize.w * zoom + pan.x;
              const sy = pin.y * effectiveSize.h * zoom + pan.y;
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); removePin(pin.id); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: sx + 16,
                    top: sy - 40,
                    pointerEvents: 'auto',
                  }}
                  className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-md"
                  title="Remove pin"
                >
                  <X size={11} strokeWidth={3} />
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Entity picker for adding a regular pin */}
      {pendingPos && tool === 'addPin' && (
        <EntityPicker
          title="Pin which entity?"
          onPick={onPickForPin}
          onClose={() => { setPendingPos(null); setTool('view'); }}
        />
      )}

      {pickerForProto && (
        <EntityPicker
          title="Protagonist (current character)"
          allowedTypes={['characters']}
          onPick={onPickForProtagonist}
          onClose={() => { setPickerForProto(false); setPendingPos(null); setTool('view'); }}
        />
      )}

      {pendingCustomUpload && (
        <CustomStampUploadModal
          initialName={pendingCustomUpload.initialName}
          svg={pendingCustomUpload.svg}
          onSave={handleSaveCustomStamp}
          onClose={() => setPendingCustomUpload(null)}
        />
      )}

      {customStampToDelete && (
        <ConfirmModal
          title="Delete custom stamp?"
          message={`"${customStampToDelete.name}" will be removed from your stamp library. Any maps already using it will keep showing it until you remove those instances. This can't be undone.`}
          confirmLabel="Delete stamp"
          onConfirm={handleConfirmDeleteCustomStamp}
          onClose={() => setCustomStampToDelete(null)}
        />
      )}

      {deletingMap && (
        <ConfirmModal
          title="Delete map?"
          message={`"${map.name || 'Untitled map'}" and everything drawn or pinned on it will be removed. The original image file (if any) is also deleted from disk.`}
          confirmLabel="Delete map"
          onConfirm={async () => { await deleteMap(map.id); navigate('/maps'); }}
          onClose={() => setDeletingMap(false)}
        />
      )}

      {confirmClear && (
        <ConfirmModal
          title="Clear all strokes?"
          message={`This removes every drawn stroke from "${map.name || 'this map'}". Pins and the background are unaffected. You can undo with ⌘Z right after.`}
          confirmLabel="Clear strokes"
          onConfirm={handleClearAll}
          onClose={() => setConfirmClear(false)}
        />
      )}

      {showKeyboardHelp && (
        <Modal title="Keyboard Shortcuts" onClose={() => setShowKeyboardHelp(false)} size="md">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Tools</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Hand / Pan</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">V</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Pen</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">P</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Eraser</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">E</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Stamps</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">S</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Cancel / Back to View</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">ESC</kbd>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Layers</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Switch to Terrain</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">1</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Switch to Rivers</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">2</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Switch to Roads</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">3</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Switch to Annotations</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">4</kbd>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">View</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Zoom In</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">+</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Zoom Out</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">-</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Reset Zoom & Pan</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">0</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Zoom to Fit</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">F</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Toggle Grid</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">G</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Toggle Snap to Grid</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">N</kbd>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Edit</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Undo</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">⌘Z</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Redo</span>
                  <kbd className="px-2 py-0.5 rounded bg-secondary border border-border font-mono text-xs">⌘⇧Z</kbd>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showGenerateModal && (
        <GenerateShapeModal
          onGenerate={handleGenerateShape}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </>
  );
}

// ── Generate Shape Modal ──────────────────────────────────────────────────────
function GenerateShapeModal({ onGenerate, onClose }) {
  const [shapeType, setShapeType] = useState('island');
  const [size, setSize] = useState(3000);
  const [complexity, setComplexity] = useState('medium');

  const shapeTypes = [
    { value: 'island', label: 'Island', desc: 'Circular landmass with moderate variation' },
    { value: 'continent', label: 'Continent', desc: 'Large landmass with dramatic coastlines' },
    { value: 'archipelago', label: 'Archipelago', desc: 'Fragmented island chain' },
    { value: 'region', label: 'Region', desc: 'Custom territory shape' },
    { value: 'coastline', label: 'Coastline', desc: 'Detailed coastal border' },
  ];

  return (
    <Modal title="Generate Shape" onClose={onClose} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Shape Type</label>
          <div className="space-y-2">
            {shapeTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setShapeType(type.value)}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                  shapeType === type.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                <div className="font-medium text-sm text-foreground">{type.label}</div>
                <div className="text-xs text-muted-foreground">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
            Size: {size}px
          </label>
          <input
            type="range"
            min="500"
            max="8000"
            step="100"
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Small</span>
            <span>Large</span>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Complexity</label>
          <div className="flex gap-2">
            {['simple', 'medium', 'complex'].map(c => (
              <button
                key={c}
                onClick={() => setComplexity(c)}
                className={`flex-1 px-3 py-2 rounded-md border text-sm capitalize transition-colors ${
                  complexity === c
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(shapeType, size, complexity)}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <Sparkles size={14} /> Generate Shape
          </button>
        </div>
      </div>
    </Modal>
  );
}
