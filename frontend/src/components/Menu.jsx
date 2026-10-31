import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

const MenuContext = createContext({ close: () => {} });

// A dropdown menu anchored to its trigger. `trigger` is a function that gets
// the props to spread on the button; items close the menu when chosen.
export default function Menu({ trigger, align = 'start', width, className = '', children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const w = width === 'trigger' ? r.width : undefined;
    const menuH = menuRef.current?.offsetHeight || 0;
    const below = window.innerHeight - r.bottom;
    const top = below < menuH + 8 && r.top > menuH + 8 ? r.top - menuH - 4 : r.bottom + 4;
    setPos(align === 'end'
      ? { top, right: Math.max(8, window.innerWidth - r.right), minWidth: w }
      : { top, left: Math.max(8, r.left), minWidth: w });
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return (
    <>
      {trigger({
        ref: btnRef,
        onClick: () => setOpen(o => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open && createPortal(
        <MenuContext.Provider value={{ close }}>
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', zIndex: 9999, ...(pos || { top: -9999, left: -9999 }) }}
            className={`max-h-[70vh] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-menu ${className}`}
          >
            {children}
          </div>
        </MenuContext.Provider>,
        document.body,
      )}
    </>
  );
}

export function MenuItem({ icon: Icon, onSelect, danger, checked, children, trailing }) {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      onClick={() => { close(); onSelect?.(); }}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent ${
        danger ? 'text-destructive' : 'text-popover-foreground'
      }`}
    >
      {Icon && <Icon size={16} className={danger ? '' : 'text-muted-foreground'} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
      {checked && <Check size={16} className="shrink-0" />}
    </button>
  );
}

export function MenuLabel({ children }) {
  return <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}

export function MenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-border" />;
}
