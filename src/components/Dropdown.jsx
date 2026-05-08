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
        className="flex items-center justify-between w-full gap-2 bg-secondary text-secondary-foreground text-sm rounded-md px-3 py-1.5 hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div style={{ ...dropdownStyle, zIndex: 9999 }} className="min-w-[160px] bg-popover border border-border rounded-lg shadow-xl py-1 overflow-y-auto max-h-72">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-left text-popover-foreground hover:bg-secondary transition-colors"
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={13} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
