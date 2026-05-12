import { useState } from 'react';
import { FolderOpen, FileText, Layers, ArrowRight, X, Plus } from 'lucide-react';

export default function OnboardingModal({ worldsPath, onClose }) {
  const [step, setStep] = useState(0);
  const [importStatus, setImportStatus] = useState('');

  const handleImport = async () => {
    setImportStatus('');
    try {
      const result = await window.electronAPI.openWorld();
      if (result?.canceled) return;
      if (result?.error) { setImportStatus(result.error); return; }
      if (result?.success) { onClose(); }
    } catch (err) {
      setImportStatus(err.message);
    }
  };

  const steps = [
    {
      icon: <Layers size={32} className="text-violet-400" />,
      title: 'Welcome to Realm Lore',
      body: 'A local-first worldbuilding tool for writers and game masters. Your data lives entirely on your machine — no accounts, no cloud, no subscription.',
    },
    {
      icon: <FileText size={32} className="text-violet-400" />,
      title: 'Plain Markdown files',
      body: 'Every entry you create is saved as a standard .md file. Open them in Obsidian, VS Code, or any text editor — your world is never locked in.',
    },
    {
      icon: <FolderOpen size={32} className="text-violet-400" />,
      title: 'Your worlds, your way',
      body: (
        <div className="flex flex-col gap-4 text-left w-full">
          <p className="text-sm text-muted-foreground leading-relaxed text-center">
            A default world is ready to go. Or bring an existing one — just point to a folder with <code className="bg-secondary px-1 rounded text-xs">.md</code> subfolders. No JSON needed.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleImport}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-medium bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
            >
              <FolderOpen size={14} /> Import existing world folder…
            </button>
            {importStatus && (
              <p className="text-xs text-red-400 text-center">{importStatus}</p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              or just click <strong className="text-foreground">Get started</strong> to begin with a fresh world.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast  = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 flex flex-col gap-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>

        {/* Step indicators */}
        <div className="flex gap-1.5 justify-center">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-violet-500' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            {current.icon}
          </div>
          <h2 className="text-xl font-semibold text-foreground">{current.title}</h2>
          <div className="text-sm text-muted-foreground leading-relaxed w-full">{current.body}</div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 text-sm py-2.5 px-4 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? onClose : () => setStep(s => s + 1)}
            className="flex-1 flex items-center justify-center gap-2 text-sm py-2.5 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium"
          >
            {isLast ? 'Get started' : (
              <>Next <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
