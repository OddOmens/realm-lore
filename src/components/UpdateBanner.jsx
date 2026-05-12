import { useState, useEffect } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

export default function UpdateBanner() {
  const [state, setState] = useState(null); // null | 'available' | 'downloading' | 'ready'
  const [version, setVersion]   = useState('');
  const [percent, setPercent]   = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable(({ version: v }) => {
      setVersion(v);
      setState('available');
      setDismissed(false);
    });

    window.electronAPI.onUpdateProgress(({ percent: p }) => {
      setPercent(p);
      setState('downloading');
    });

    window.electronAPI.onUpdateDownloaded(({ version: v }) => {
      setVersion(v);
      setState('ready');
    });
  }, []);

  if (!state || dismissed) return null;

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed bottom-4 right-4 max-w-sm w-full bg-card border border-border rounded-xl shadow-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-4 fade-in"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {state === 'available' && <Download size={16} className="text-violet-400 shrink-0 mt-0.5" />}
          {state === 'downloading' && <RefreshCw size={16} className="text-violet-400 shrink-0 mt-0.5 animate-spin" />}
          {state === 'ready' && <RefreshCw size={16} className="text-green-400 shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-medium text-foreground">
              {state === 'available'   && `Realm Lore ${version} available`}
              {state === 'downloading' && `Downloading update… ${percent}%`}
              {state === 'ready'       && `Realm Lore ${version} ready to install`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {state === 'available'   && 'Downloading in the background.'}
              {state === 'downloading' && 'Installing automatically when done.'}
              {state === 'ready'       && 'Restart Realm Lore to apply the update.'}
            </p>
          </div>
        </div>
        {state !== 'downloading' && (
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {state === 'downloading' && (
        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-violet-500 transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {state === 'ready' && (
        <div className="flex gap-2">
          <button
            onClick={() => window.electronAPI.installUpdate()}
            className="flex-1 text-sm py-1.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors font-medium"
          >
            Restart & Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-sm py-1.5 px-3 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
