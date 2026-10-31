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
      className="fixed z-50 min-w-[180px] bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1 overflow-hidden animate-menu"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="-mx-1 my-1 h-px bg-border" />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-accent ${item.danger ? 'text-destructive' : 'text-popover-foreground [&>svg]:text-muted-foreground'}`}
          >
            {item.icon && <item.icon size={15} />}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
