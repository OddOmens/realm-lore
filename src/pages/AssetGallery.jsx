import React, { useState, useEffect } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';

export default function AssetGallery() {
  const activeWorld = useWorldStore(s => s.activeWorld);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

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
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="text-muted-foreground" size={18} />
          <h2 className="text-base font-semibold text-foreground">Asset Gallery</h2>
        </div>
        <button
          onClick={handleImport}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-2 transition-colors"
        >
          <Upload size={14} /> Upload Image
        </button>
      </div>
      <div className="p-6 flex-1 overflow-y-auto">
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
            {assets.map(asset => (
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
