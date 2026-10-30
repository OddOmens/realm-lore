import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('contextmenu', onClose);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('contextmenu', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-lg shadow-xl py-1 overflow-hidden"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-popover-foreground hover:bg-secondary'}`}
          >
            {item.icon && <item.icon size={14} />}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
