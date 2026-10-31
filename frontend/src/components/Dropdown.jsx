import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Dropdown({ value, options, onChange, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownH = Math.min(options.length * 38, 280);
      if (spaceBelow < dropdownH && rect.top > dropdownH) {
        setDropdownStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width, top: 'auto' });
      } else {
        setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    }
    setOpen(o => !o);
  };

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative w-full">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center justify-between w-full h-8 gap-2 border border-input bg-background text-foreground text-sm rounded-md px-2.5 hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div style={{ ...dropdownStyle, zIndex: 9999 }} className="min-w-[160px] bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1 overflow-y-auto max-h-72 animate-menu">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="flex items-center justify-between w-full rounded-md px-2 py-1.5 text-sm text-left text-popover-foreground hover:bg-accent transition-colors"
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={15} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
