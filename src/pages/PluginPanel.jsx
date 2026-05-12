import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Puzzle, AlertCircle, Loader2 } from 'lucide-react';
import { usePluginStore } from '../store/usePluginStore';

export default function PluginPanel() {
  const { panelId } = useParams();
  const panels = usePluginStore(s => s.panels);
  const loadPanelComponent = usePluginStore(s => s.loadPanelComponent);
  const panelComponents = usePluginStore(s => s.panelComponents);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const panel = panels.find(p => p.panelId === panelId);
  const Component = panelComponents[panelId];

  useEffect(() => {
    if (!panel || Component) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    loadPanelComponent(panelId)
      .then(comp => { if (!comp) setError('Panel component could not be loaded.'); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [panelId, panel, Component, loadPanelComponent]);

  if (!panel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-12">
        <Puzzle size={40} className="opacity-30" />
        <p className="text-sm">Plugin panel not found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-12">
        <Loader2 size={24} className="animate-spin opacity-50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-400 p-12">
        <AlertCircle size={32} />
        <p className="text-sm font-medium">Failed to load panel</p>
        <p className="text-xs text-muted-foreground font-mono max-w-md text-center">{error}</p>
      </div>
    );
  }

  if (!Component) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <Component />
    </div>
  );
}
