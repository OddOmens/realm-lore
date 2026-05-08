import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map as MapIcon, Plus, Image as ImageIcon, Trash2, Pin,
  Search, X, Upload, Pencil,
} from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB safety ceiling for a single map image
const DEFAULT_CANVAS_W = 2000;
const DEFAULT_CANVAS_H = 1500;

// Paper presets for blank canvases. All map-style light colors so dark ink
// reads cleanly on top \u2014 dark backgrounds didn't fit the "draw a map" use case.
const PAPERS = [
  { id: 'white',     label: 'White',         color: '#ffffff' },
  { id: 'parchment', label: 'Parchment',     color: '#efe6cc' },
  { id: 'aged',      label: 'Aged Paper',    color: '#d9c8a3' },
  { id: 'vellum',    label: 'Vellum',        color: '#f5e9c9' },
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
    img.onerror = () => resolve({ w: DEFAULT_CANVAS_W, h: DEFAULT_CANVAS_H });
    img.src = dataUrl;
  });
}

function NewMapModal({ onSave, onClose }) {
  const [name, setName]         = useState('');
  const [useImage, setUseImage] = useState(false);
  const [image, setImage]       = useState('');
  const [paperId, setPaperId]   = useState('parchment');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const fileRef = useRef(null);

  const paper = PAPERS.find(p => p.id === paperId) || PAPERS[0];

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('That file isn\u2019t an image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Keep it under ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      setImage(dataUrl);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the map a name.'); return; }
    setBusy(true);
    try {
      if (useImage) {
        if (!image) { setError('Upload a background image, or switch to a blank canvas.'); setBusy(false); return; }
        const { w, h } = await loadImageDimensions(image);
        await onSave({
          name: name.trim(),
          image,
          canvasSize: { w, h },
          paperColor: paper.color,
          pins: [],
          protagonist: null,
          strokes: [],
        });
      } else {
        await onSave({
          name: name.trim(),
          // No image \u2014 blank canvas
          canvasSize: { w: DEFAULT_CANVAS_W, h: DEFAULT_CANVAS_H },
          paperColor: paper.color,
          pins: [],
          protagonist: null,
          strokes: [],
        });
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="New Map" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. The Northern Reaches"
            className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        {/* Mode toggle: Blank canvas (default) vs Background image */}
        <div className="flex gap-2 p-1 bg-secondary/40 rounded-md border border-border">
          <button
            type="button"
            onClick={() => setUseImage(false)}
            className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors ${
              !useImage ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Pencil size={14} /> Blank Canvas
          </button>
          <button
            type="button"
            onClick={() => setUseImage(true)}
            className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors ${
              useImage ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon size={14} /> Background Image
          </button>
        </div>

        {!useImage && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Paper</label>
            <div className="grid grid-cols-4 gap-2">
              {PAPERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaperId(p.id)}
                  className={`group relative h-14 rounded-md border-2 overflow-hidden transition-all ${
                    paperId === p.id ? 'border-primary' : 'border-border hover:border-primary/40'
                  }`}
                  title={p.label}
                  style={{ backgroundColor: p.color }}
                >
                  <span className="absolute bottom-0.5 inset-x-0 text-[10px] font-medium text-center opacity-0 group-hover:opacity-100 transition-opacity text-stone-800">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Default canvas is {DEFAULT_CANVAS_W} \u00d7 {DEFAULT_CANVAS_H}. You can draw on it with the pen tool.
            </p>
          </div>
        )}

        {useImage && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0])}
            />
            {image ? (
              <div className="relative rounded-lg border border-border overflow-hidden bg-secondary/30">
                <img src={image} alt="Map preview" className="w-full max-h-64 object-contain" />
                <button
                  type="button"
                  onClick={pickFile}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs flex items-center gap-1 hover:bg-black/80 transition-colors"
                >
                  <Upload size={11} /> Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={pickFile}
                className="w-full border-2 border-dashed border-border rounded-lg py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/40 hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <ImageIcon size={28} className="opacity-60" />
                <span className="text-sm">Click to upload a background image</span>
                <span className="text-xs opacity-60">PNG, JPG, WebP &middot; max {MAX_IMAGE_BYTES / 1024 / 1024} MB</span>
              </button>
            )}
            <p className="text-xs text-muted-foreground/60 mt-2">
              You can still draw on top of the image once it\u2019s loaded.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving\u2026' : 'Create Map'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MapCard({ map, onOpen, onDelete }) {
  const pinCount = (map.pins?.length || 0) + (map.protagonist ? 1 : 0);
  const strokeCount = map.strokes?.length || 0;
  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      <button
        onClick={onOpen}
        className="block w-full aspect-[4/3] overflow-hidden"
        style={{ backgroundColor: map.paperColor || '#efe6cc' }}
      >
        {map.image ? (
          <img
            src={map.image}
            alt={map.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-700/40">
            <Pencil size={32} />
          </div>
        )}
      </button>
      <div className="p-3 flex items-start justify-between gap-2">
        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground truncate">{map.name || 'Untitled map'}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1"><Pin size={10} /> {pinCount}</span>
            <span className="flex items-center gap-1"><Pencil size={10} /> {strokeCount}</span>
          </p>
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
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
      <div className="flex-1 px-4 py-6 md:p-8 overflow-y-auto w-full">
        <header className="flex justify-between items-start gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <MapIcon size={22} className="text-emerald-400" />
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Maps</h2>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Draw your world from scratch or import a background image, then pin the places that matter.
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} /> New Map
          </button>
        </header>

        {maps.length > 0 && (
          <div className="relative mb-5 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search maps\u2026"
              className="w-full bg-secondary text-foreground text-sm rounded-md pl-9 pr-9 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {maps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center max-w-xl mx-auto">
            <Pencil size={36} className="text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-1">No maps yet</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Start with a blank canvas and draw your world by hand, or upload an existing image
              to annotate. Then pin your characters, locations, and points of interest.
            </p>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={15} /> Create your first map
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
