import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

/** Floating toast driven by `window.dispatchEvent(new CustomEvent('wb-save-flash', { detail: { label } }))`. */
export default function SaveBanner() {
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let timer;
    const onFlash = (e) => {
      clearTimeout(timer);
      const label = e.detail?.label || 'Saved';
      setMsg(label);
      timer = setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener('wb-save-flash', onFlash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('wb-save-flash', onFlash);
    };
  }, []);

  if (!msg) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg text-sm text-foreground"
      role="status"
    >
      <CheckCircle2 size={14} className="text-green-400 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}
