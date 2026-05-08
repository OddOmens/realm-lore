import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { Users, Map, Box, BookMarked, Flag, PawPrint } from 'lucide-react';
import { serializeNode, getCaretOffset, setCaretOffset, stripBrackets, buildEditHTML } from './richEditor';

const TYPE_META = {
  characters: { icon: Users,       color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30'   },
  locations:  { icon: Map,         color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
  things:     { icon: Box,         color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30'  },
  lore:       { icon: BookMarked,  color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  factions:   { icon: Flag,        color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  creatures:  { icon: PawPrint,    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
};

export default function MentionEditor({ value, onChange, placeholder, onHeightChange }) {
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);

  const allEntities = useMemo(() => [
    ...characters.map(e => ({ ...e, _type: 'characters' })),
    ...locations.map(e  => ({ ...e, _type: 'locations'  })),
    ...things.map(e     => ({ ...e, _type: 'things'     })),
    ...lore.filter(e => !e._isTimelineEvent && e.name).map(e => ({ ...e, _type: 'lore' })),
    ...factions.map(e   => ({ ...e, _type: 'factions'   })),
    ...creatures.map(e  => ({ ...e, _type: 'creatures'  })),
  ].filter(e => e.name), [characters, locations, things, lore, factions, creatures]);

  const [mention, setMention] = useState(null);
  const [menuCursor, setMenuCursor] = useState(0);
  const [menuStyle, setMenuStyle] = useState({});

  const editorRef    = useRef(null);
  const menuRef      = useRef(null);
  const composing    = useRef(false);
  const pendingCaret = useRef(null);
  const initRef      = useRef(false);

  const render = (text) => buildEditHTML(stripBrackets(text || ''));

  // Initial render
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!initRef.current) {
      initRef.current = true;
      el.innerHTML = render(value);
    }
  }, []); // eslint-disable-line

  // Restore pending caret after render
  useEffect(() => {
    if (pendingCaret.current === null) return;
    const el = editorRef.current;
    if (!el) return;
    const off = pendingCaret.current;
    pendingCaret.current = null;
    requestAnimationFrame(() => { if (editorRef.current) setCaretOffset(editorRef.current, off); });
  });

  const handleInput = useCallback(() => {
    if (composing.current) return;
    const el = editorRef.current;
    if (!el) return;
    const raw = serializeNode(el).replace(/\n$/, '');
    const caret = getCaretOffset(el);
    onChange(raw);
    if (onHeightChange) onHeightChange(el.scrollHeight);

    // @ mention detection
    const before = raw.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1 && !before.slice(atIdx).includes('\n')) {
      const query = before.slice(atIdx + 1);
      if (query.length < 20) {
        setMention({ query, atPos: atIdx, caretPos: caret });
        return;
      }
    }
    setMention(null);
  }, [onChange, onHeightChange]);

  const mentionSuggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return allEntities.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, allEntities]);

  useEffect(() => {
    queueMicrotask(() => setMenuCursor(0));
  }, [mentionSuggestions]);

  const insertMention = useCallback((entity) => {
    if (!mention || !editorRef.current) return;
    const el = editorRef.current;
    const text = serializeNode(el).replace(/\n$/, '');
    const next = text.slice(0, mention.atPos) + entity.name + text.slice(mention.caretPos);
    const newCaret = mention.atPos + entity.name.length;
    el.innerHTML = render(next);
    pendingCaret.current = newCaret;
    onChange(next);
    setMention(null);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [mention, onChange]);

  const handleKeyDown = useCallback((e) => {
    if (mention && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuCursor(c => Math.min(c+1, mentionSuggestions.length-1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMenuCursor(c => Math.max(c-1, 0)); return; }
      if (e.key === 'Escape')    { setMention(null); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); insertMention(mentionSuggestions[menuCursor]); return; }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const el = editorRef.current;
      if (!el) return;
      const caret = getCaretOffset(el);
      const text = serializeNode(el).replace(/\n$/, '');
      const next = text.slice(0, caret) + '\n' + text.slice(caret);
      el.innerHTML = render(next);
      pendingCaret.current = caret + 1;
      onChange(next);
    }
  }, [mention, mentionSuggestions, menuCursor, insertMention, onChange]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const el = editorRef.current;
    if (!el) return;
    const text = e.clipboardData.getData('text/plain');
    const caret = getCaretOffset(el);
    const current = serializeNode(el).replace(/\n$/, '');
    const next = current.slice(0, caret) + text + current.slice(caret);
    el.innerHTML = render(next);
    pendingCaret.current = caret + text.length;
    onChange(next);
  }, [onChange]);

  const handleCompositionStart = useCallback(() => { composing.current = true; }, []);
  const handleCompositionEnd   = useCallback(() => { composing.current = false; handleInput(); }, [handleInput]);

  useEffect(() => {
    if (!mention || !editorRef.current) return;
    const rect = editorRef.current.getBoundingClientRect();
    const text = serializeNode(editorRef.current).replace(/\n$/, '');
    const lines = text.slice(0, mention.atPos).split('\n').length;
    const top  = rect.top + (lines - 1) * 32 + 36;
    const left = rect.left + 32;
    setMenuStyle({ top: Math.min(top, window.innerHeight - 280), left: Math.min(left, window.innerWidth - 320) });
  }, [mention]);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMention(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        data-placeholder={placeholder}
        className="w-full max-w-3xl bg-transparent border-none focus:outline-none text-lg font-story leading-relaxed"
        style={{
          color: 'inherit',
          minHeight: '800px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          caretColor: 'currentColor',
          outline: 'none',
        }}
      />
      <p className="absolute bottom-2 right-0 text-xs pointer-events-none" style={{ color: 'rgba(0,0,0,0.3)' }}>
        Type @ to search entities
      </p>

      {mention && mentionSuggestions.length > 0 && (
        <div
          ref={menuRef}
          style={{ ...menuStyle, position: 'fixed' }}
          className="z-50 w-72 bg-popover border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden"
        >
          <p className="px-3 pb-1 text-xs text-muted-foreground font-medium">
            {mention.query ? `Matching "${mention.query}"` : 'All entities'} — Tab or Enter to insert
          </p>
          {mentionSuggestions.map((e, i) => {
            const meta = TYPE_META[e._type];
            const Icon = meta.icon;
            return (
              <button
                key={e.id}
                onMouseDown={(ev) => { ev.preventDefault(); insertMention(e); }}
                onMouseEnter={() => setMenuCursor(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === menuCursor ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
              >
                <span className={`shrink-0 p-1.5 rounded-md border ${meta.bg} ${meta.border}`}>
                  <Icon size={12} className={meta.color} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {e._type.slice(0, -1)}{e.type ? ` · ${e.type}` : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
