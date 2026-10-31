import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map as MapIcon, Plus, Image as ImageIcon, Trash2, Pin,
  Search, X, Upload, Sparkles, Waves, Castle,
} from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { assetUrl } from '../lib/api';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB safety ceiling for a single map image

// A new map-builder document: land is painted in the editor.
const NEW_MAP_DOC = {
  version: 2, paths: [], places: [], labels: [], stamps: [], pins: [],
  protagonist: null, reference: null, hidden: { grid: true },
};

const STARTS = [
  { id: 'generate', label: 'Generate a continent', hint: 'Start from a random landmass you can reshape.', icon: Sparkles },
  { id: 'blank',    label: 'Blank sea',            hint: 'Paint every coastline yourself.',           icon: Waves },
  { id: 'image',    label: 'Trace an image',       hint: 'Put a map picture underneath and paint over it.', icon: ImageIcon },
];

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function loadImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 2000, h: 1500 });
    img.src = dataUrl;
  });
}

function NewMapModal({ onSave, onClose }) {
  const [name, setName]   = useState('');
  const [start, setStart] = useState('generate');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) { setError('That file isn\u2019t an image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Keep it under ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
      return;
    }
    try { setImage(await readFileAsDataURL(file)); } catch (e) { setError(e.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the map a name.'); return; }
    if (start === 'image' && !image) { setError('Choose an image to trace, or pick another start.'); return; }
    setBusy(true);
    try {
      const data = { name: name.trim(), ...NEW_MAP_DOC, autoGenerate: start === 'generate' };
      if (start === 'image') {
        // Centre the picture on the origin at its natural size; the editor fits it on open.
        const { w, h } = await loadImageDimensions(image);
        data.image = image;
        data.reference = { x: -w / 2, y: -h / 2, w, h, opacity: 0.6 };
      }
      await onSave(data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="New map" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Northern Reaches" className="input" />
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-foreground">Start with</span>
          {STARTS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStart(s.id)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${start === s.id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-accent/60'}`}
            >
              <s.icon size={18} className={start === s.id ? 'text-brand' : 'text-muted-foreground'} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {start === 'image' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            {image ? (
              <div className="relative rounded-lg border border-border overflow-hidden bg-surface">
                <img src={assetUrl(image)} alt="Map preview" className="w-full max-h-56 object-contain" />
                <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-outline btn-sm absolute top-2 right-2 bg-popover">
                  <Upload /> Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-input rounded-lg py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <ImageIcon size={24} className="opacity-60" />
                <span className="text-sm">Choose an image</span>
                <span className="text-xs opacity-60">PNG, JPG, WebP &middot; max {MAX_IMAGE_BYTES / 1024 / 1024} MB</span>
              </button>
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Saving\u2026' : 'Create map'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MapCard({ map, onOpen, onDelete }) {
  const activeWorld = useWorldStore(s => s.activeWorld);
  const pinCount = (map.pins?.length || 0) + (map.protagonist ? 1 : 0);
  const placeCount = map.places?.length || 0;
  // Map-builder maps save a rendered thumbnail; old maps show their image.
  const src = map.thumbAt
    ? `asset://${activeWorld}/maps/${map.id}.thumb.img?v=${map.thumbAt}`
    : map.image
      ? (map.image.startsWith('__local__') ? `asset://${activeWorld}/maps/${map.image.replace('__local__', '')}.img` : map.image)
      : null;
  return (
    <div className="group relative card card-hover overflow-hidden">
      <button
        onClick={onOpen}
        className="relative block w-full aspect-[4/3] overflow-hidden border-b border-border"
        style={{ backgroundColor: '#a9c3c4' }}
      >
        {/* An empty map, or an image that fails to load, shows the map icon. */}
        <div className="absolute inset-0 flex items-center justify-center text-[#4a3b2a]/40">
          <MapIcon size={28} />
        </div>
        {src && (
          <img
            src={assetUrl(src)}
            alt={map.name}
            className="relative w-full h-full object-cover"
            draggable={false}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}
      </button>
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground truncate">{map.name || 'Untitled map'}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1"><Castle size={10} /> {placeCount}</span>
            <span className="flex items-center gap-1"><Pin size={10} /> {pinCount}</span>
          </p>
        </button>
        <button
          onClick={onDelete}
          className="btn btn-ghost btn-icon btn-sm hover:text-destructive opacity-0 group-hover:opacity-100"
          title="Delete map"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Maps() {
  const maps = useWorldStore(s => s.maps);
  const saveMap = useWorldStore(s => s.saveMap);
  const deleteMap = useWorldStore(s => s.deleteMap);
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? maps.filter(m => (m.name || '').toLowerCase().includes(q)) : maps;
    return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [maps, query]);

  const handleCreate = async (data) => {
    const created = await saveMap(data);
    setAdding(false);
    if (created?.id) navigate(`/maps/${created.id}`);
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto w-full">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-3 sm:px-8 md:pt-8 flex flex-col gap-4">
          <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <MapIcon size={20} className="shrink-0 text-muted-foreground" />
                <h1 className="page-title truncate">Maps</h1>
              </div>
              <p className="page-subtitle">
                Paint continents, rivers and cities on an endless canvas, then pin the places that matter.
              </p>
            </div>
            <button onClick={() => setAdding(true)} className="btn btn-primary">
              <Plus /> New map
            </button>
          </header>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search maps…"
              className="input pl-8 pr-8"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-8 sm:px-8">

        {maps.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center rounded-lg border border-dashed border-border">
            <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
              <MapIcon size={18} />
            </span>
            <h3 className="text-sm font-semibold text-foreground">No maps yet</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground mb-4">
              Generate a continent or paint one yourself: grassland, forests, deserts, mountains,
              lakes, rivers, roads and towns. Then pin your characters and locations.
            </p>
            <button
              onClick={() => setAdding(true)}
              className="btn btn-primary"
            >
              <Plus /> Create your first map
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(m => (
              <MapCard
                key={m.id}
                map={m}
                onOpen={() => navigate(`/maps/${m.id}`)}
                onDelete={() => setDeleting(m)}
              />
            ))}
          </div>
        )}
      </div>
    </div>

      {adding && (
        <NewMapModal onSave={handleCreate} onClose={() => setAdding(false)} />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete map?"
          message={`"${deleting.name || 'Untitled map'}" and everything drawn or pinned on it will be removed. The original image file (if any) is also deleted from disk.`}
          confirmLabel="Delete map"
          onConfirm={async () => { await deleteMap(deleting.id); setDeleting(null); }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
