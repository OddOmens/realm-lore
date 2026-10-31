import { useState, useEffect } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { api, assetUrl } from '../lib/api';
import { Upload, Trash2, Image as ImageIcon, Search, X } from 'lucide-react';

export default function AssetGallery() {
  const activeWorld = useWorldStore(s => s.activeWorld);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchAssets = async () => {
    if (!activeWorld) return;
    setLoading(true);
    try {
      const res = await api.listAssets({ world: activeWorld });
      setAssets(res.assets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [activeWorld]);

  const handleImport = async () => {
    try {
      const res = await api.importAsset({ world: activeWorld });
      if (res.success) {
        fetchAssets();
      }
    } catch (e) {
      console.error(e);
      alert('Failed to import asset');
    }
  };

  const handleDelete = async (assetPath) => {
    if (!confirm('Are you sure you want to delete this asset? It will be removed from any entities using it.')) return;
    try {
      const res = await api.deleteAsset({ world: activeWorld, assetPath });
      if (res.success) {
        setAssets(assets.filter(a => a.rel !== assetPath));
      }
    } catch (e) {
      console.error(e);
      alert('Failed to delete asset');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-3 sm:px-8 md:pt-8 flex flex-col gap-4">
          <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <ImageIcon size={20} className="shrink-0 text-muted-foreground" />
                <h1 className="page-title truncate">Asset Gallery</h1>
              </div>
              <p className="page-subtitle">Manage uploaded images for characters, locations, and more.</p>
            </div>
            <button onClick={handleImport} className="btn btn-primary">
              <Upload /> Upload image
            </button>
          </header>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search assets…"
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
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading assets...</p>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center rounded-lg border border-dashed border-border">
            <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
              <ImageIcon size={18} />
            </span>
            <h3 className="text-sm font-semibold text-foreground">No assets uploaded</h3>
            <p className="mt-1 text-muted-foreground text-sm max-w-sm mx-auto mb-4">
              Upload character portraits, location maps, and item art to use across your world.
            </p>
            <button
              onClick={handleImport}
              className="btn btn-primary"
            >
              <Upload /> Upload first image
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {(query.trim() ? assets.filter(a => a.label?.toLowerCase().includes(query.trim().toLowerCase())) : assets).map(asset => (
              <div key={asset.rel} className="group relative card card-hover overflow-hidden flex flex-col">
                <div className="aspect-square bg-surface relative flex items-center justify-center p-2">
                  <img src={assetUrl(`asset://${activeWorld}/assets/${asset.rel}`)} alt={asset.label} className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDelete(asset.rel)}
                      className="btn btn-icon btn-sm bg-popover text-destructive ring-1 ring-foreground/10 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                      title="Delete asset"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="px-2.5 py-2 border-t border-border">
                  <p className="text-xs font-medium text-foreground truncate" title={asset.label}>{asset.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
