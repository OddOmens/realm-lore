import React, { useState, useEffect } from 'react';
import { useWorldStore } from '../store/useWorldStore';
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
      if (window.electronAPI && window.electronAPI.listAssets) {
        const res = await window.electronAPI.listAssets({ world: activeWorld });
        setAssets(res.assets || []);
      }
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
    if (!window.electronAPI || !window.electronAPI.importAsset) return;
    try {
      const res = await window.electronAPI.importAsset({ world: activeWorld });
      if (res.success) {
        fetchAssets();
      }
    } catch (e) {
      console.error(e);
      alert('Failed to import asset');
    }
  };

  const handleDelete = async (assetPath) => {
    if (!window.electronAPI || !window.electronAPI.deleteAsset) return;
    if (!confirm('Are you sure you want to delete this asset? It will be removed from any entities using it.')) return;
    try {
      const res = await window.electronAPI.deleteAsset({ world: activeWorld, assetPath });
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
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 pt-6 pb-3 md:px-8 md:pt-8 mb-5 border-b border-border/40 flex flex-col gap-5 shadow-sm">
        <header>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <ImageIcon size={22} className="text-muted-foreground" />
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Asset Gallery</h2>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">Manage uploaded images for characters, locations, and more.</p>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-full pl-9 pr-9 py-2 text-sm bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            <button
              onClick={handleImport}
              className="shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Upload size={15} /> Upload Image
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 pb-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading assets...</p>
        ) : assets.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No assets uploaded</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Upload character portraits, location maps, and item art to use across your world.
            </p>
            <button
              onClick={handleImport}
              className="px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium border border-border hover:bg-secondary/80 flex items-center gap-2 mx-auto"
            >
              <Upload size={14} /> Upload First Image
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {(query.trim() ? assets.filter(a => a.label?.toLowerCase().includes(query.trim().toLowerCase())) : assets).map(asset => (
              <div key={asset.rel} className="group relative rounded-md border border-border bg-card overflow-hidden flex flex-col">
                <div className="aspect-square bg-secondary/30 relative flex items-center justify-center p-2">
                  <img src={`asset://${activeWorld}/assets/${asset.rel}`} alt={asset.label} className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDelete(asset.rel)}
                      className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full transition-colors"
                      title="Delete asset"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-2 border-t border-border">
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
