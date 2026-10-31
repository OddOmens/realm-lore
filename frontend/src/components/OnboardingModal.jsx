import { useState } from 'react';
import { FolderOpen, FileText, Layers, ArrowRight, X, Upload } from 'lucide-react';
import { api } from '../lib/api';

export default function OnboardingModal({ worldsPath, onClose }) {
  const [step, setStep] = useState(0);
  const [importStatus, setImportStatus] = useState('');

  const handleImport = async () => {
    setImportStatus('');
    try {
      const result = await api.openWorld();
      if (result?.canceled) return;
      if (result?.error) { setImportStatus(result.error); return; }
      if (result?.success) { onClose(); }
    } catch (err) {
      setImportStatus(err.message);
    }
  };

  const steps = [
    {
      icon: <Layers size={22} />,
      title: 'Welcome to Realm Lore',
      body: 'A self-hosted worldbuilding tool for writers and game masters. Your data lives on your own server — no third-party cloud, no subscription.',
    },
    {
      icon: <FileText size={22} />,
      title: 'Plain Markdown files',
      body: 'Every entry you create is saved as a standard .md file. Open them in Obsidian, VS Code, or any text editor — your world is never locked in.',
    },
    {
      icon: <FolderOpen size={22} />,
      title: 'Your worlds, your way',
      body: (
        <div className="flex flex-col gap-4 text-left w-full">
          <p className="text-sm text-muted-foreground leading-relaxed text-center">
            A default world is ready to go. Or bring an existing one — just upload a folder from your computer with <code className="bg-muted px-1 rounded text-xs">.md</code> subfolders. No JSON needed.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleImport}
              className="btn btn-outline h-9 w-full"
            >
              <Upload /> Upload existing world folder…
            </button>
            {importStatus && (
              <p className="text-xs text-destructive text-center">{importStatus}</p>
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-backdrop-in">
      <div role="dialog" aria-modal="true" className="relative bg-popover text-popover-foreground sm:ring-1 sm:ring-foreground/10 rounded-t-[14px] sm:rounded-xl shadow-lg w-full sm:max-w-md sm:mx-4 p-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))] sm:pb-7 flex flex-col gap-6 animate-sheet">
        <button
          onClick={onClose}
          className="btn btn-ghost btn-icon btn-sm absolute top-3 right-3"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Step indicators */}
        <div className="flex gap-1.5 justify-center">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-foreground' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            {current.icon}
          </div>
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">{current.title}</h2>
          <div className="text-sm text-muted-foreground leading-relaxed w-full">{current.body}</div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="btn btn-outline h-9 flex-1"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? onClose : () => setStep(s => s + 1)}
            className="btn btn-primary h-9 flex-1"
          >
            {isLast ? 'Get started' : (
              <>Next <ArrowRight /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
