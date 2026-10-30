import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useSheetDismiss } from '../lib/sheet';

// A centred dialog on wide screens; on phones, an iOS sheet that rises from
// the bottom and can be dragged down to close.
export default function Modal({ title, children, onClose, size = 'md' }) {
  const overlayRef = useRef(null);
  const sheetRef = useRef(null);
  const { dismiss, dragHandlers } = useSheetDismiss(sheetRef, overlayRef, onClose);

  const onKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const sizeClass = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-2xl',
    '2xl': 'sm:max-w-4xl',
  }[size] || 'sm:max-w-md';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in"
      onMouseDown={(e) => { if (e.target === overlayRef.current) dismiss(); }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${sizeClass} sm:mx-4 bg-card border border-border border-b-0 sm:border-b rounded-t-[14px] sm:rounded-xl shadow-2xl max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] sm:max-h-[90vh] flex flex-col animate-sheet`}
      >
        <div {...dragHandlers} className="sm:hidden flex justify-center pt-[6px] pb-1 shrink-0 touch-none">
          <div className="h-[5px] w-9 rounded-full bg-muted-foreground/40" />
        </div>
        <div {...dragHandlers} className="flex items-center justify-between px-6 pt-1 pb-3 sm:py-4 border-b border-border shrink-0 touch-none sm:touch-auto">
          <h2 className="text-[17px] sm:text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="p-1.5 sm:p-1 rounded-full sm:rounded-md bg-secondary sm:bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
