import TextareaAutosize from 'react-textarea-autosize';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CheckCircle2, Loader2, Save, Tag,
  ExternalLink, Link2, Trash2, Plus, List, Bold, Italic,
  Heading2, AlignLeft, ChevronDown, ChevronUp, Edit3, Eye, X, Pencil,
  FileDown, Network, Star, Package, Backpack, Home, Landmark,
  ChevronRight, GripVertical, Hash, Info, Users,
} from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
import { getTemplate, getAllFieldKeys, getVisibleSections } from '../config/templates';
import ConfirmModal from '../components/ConfirmModal';
import { serializeNode, getCaretOffset, setCaretOffset, stripBrackets, buildEditHTML, parseSegments, TYPE_CHIP } from '../components/richEditor';
import { isFavorite, toggleFavorite } from '../lib/favorites';
import StatBlockEditor from '../components/dnd/StatBlockEditor';
import OrgChart from '../components/OrgChart';
import { api, assetUrl } from '../lib/api';

const AUTOSAVE_DELAY = 1200;

const COLOR = {
  blue:   { dot: 'bg-blue-400',   text: 'text-blue-400',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     header: 'from-blue-500/8',   link: 'text-blue-400'   },
  green:  { dot: 'bg-green-400',  text: 'text-green-400',  badge: 'bg-green-500/10 text-green-400 border-green-500/20',   header: 'from-green-500/8',  link: 'text-green-400'  },
  amber:  { dot: 'bg-amber-400',  text: 'text-amber-400',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   header: 'from-amber-500/8',  link: 'text-amber-400'  },
  purple: { dot: 'bg-purple-400', text: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', header: 'from-purple-500/8', link: 'text-purple-400' },
  indigo: { dot: 'bg-indigo-400', text: 'text-indigo-400', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', header: 'from-indigo-500/8', link: 'text-indigo-400' },
};

const SEMANTIC_STYLES = {
  // Statuses & Rarity
  Common:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Unknown:      'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  Uncommon:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Rare:         'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Very Rare':   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Mythical:     'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Legendary:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Endangered:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Extinct:      'bg-red-500/10 text-red-400 border-red-500/20',
  Artifact:     'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Unique:       'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  
  // Danger levels
  Harmless:     'bg-green-500/10 text-green-400 border-green-500/20',
  Low:          'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Medium:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  High:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Deadly:       'bg-red-500/10 text-red-400 border-red-500/20',
  Catastrophic: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

// Fields whose value reads as a status rather than plain text.
const BADGE_FIELDS = ['Status', 'Rarity', 'Danger', 'Danger Level', 'Condition'];

// Dot colours for the semantic values above; anything else gets a neutral dot.
const SEMANTIC_DOTS = {
  Alive: 'bg-green-500', Dead: 'bg-red-500', Undead: 'bg-purple-500', Imprisoned: 'bg-yellow-500', Missing: 'bg-amber-500',
};
// Written out in full so Tailwind sees every class.
const HUE_DOTS = {
  slate: 'bg-slate-400', zinc: 'bg-zinc-400', emerald: 'bg-emerald-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
  indigo: 'bg-indigo-500', amber: 'bg-amber-500', red: 'bg-red-500', rose: 'bg-rose-500', green: 'bg-green-500', orange: 'bg-orange-500',
};
function semanticDot(value) {
  if (SEMANTIC_DOTS[value]) return SEMANTIC_DOTS[value];
  const hue = SEMANTIC_STYLES[value]?.match(/text-([a-z]+)-400/);
  return (hue && HUE_DOTS[hue[1]]) || 'bg-muted-foreground/60';
}

function StatusBadge({ value, label }) {
  return (
    <span className="badge text-foreground">
      <span className={`size-1.5 rounded-full ${semanticDot(value)}`} />
      {label && <span className="text-muted-foreground">{label}</span>}
      {value}
    </span>
  );
}

function PropertyRow({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 py-1.5">
      <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
      <dd className="text-[0.8125rem] font-medium text-foreground break-words">{children}</dd>
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function buildEntityByName(allEntities) {
  const m = new Map();
  for (const e of allEntities) {
    if (!e.name) continue;
    m.set(e.name.toLowerCase(), { entity: e, type: e._type });
  }
  return m;
}

function renderMarkdown(text, allEntities, navigate) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  const entityByName = buildEntityByName(allEntities);

  // Render a plain-text segment using parseSegments for chip + suffix support
  const renderSegmented = (str, keyPrefix) => {
    if (!str) return null;
    const segs = parseSegments(str, entityByName);
    return segs.map((seg, si) => {
      if (seg.type === 'entity') {
        const chipClass = TYPE_CHIP[seg.meta.type] || '';
        return (
          <span key={`${keyPrefix}-${si}`} className="inline-block">
            <button
              onClick={() => navigate(`/${seg.meta.type}/${seg.meta.entity.id}`)}
              className={`inline-flex items-center px-1 py-0 rounded border text-sm font-medium cursor-pointer transition-opacity hover:opacity-80 ${chipClass}`}
            >{seg.name}</button>
            {seg.suffix && <span>{seg.suffix}</span>}
          </span>
        );
      }
      return <span key={`${keyPrefix}-${si}`}>{seg.value}</span>;
    });
  };

  const inlineRender = (line, key) => {
    // Handle **bold** and *italic* first, then use renderSegmented for plain text parts
    const parts = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let last = 0;
    let m;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(...(renderSegmented(line.slice(last, m.index), `t${last}`) || []));
      if (m[0].startsWith('**')) {
        parts.push(<strong key={`b${m.index}`} className="font-semibold text-foreground">{m[2]}</strong>);
      } else {
        parts.push(<em key={`i${m.index}`} className="italic">{m[3]}</em>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(...(renderSegmented(line.slice(last), `t${last}`) || []));
    return <span key={key}>{parts}</span>;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Heading ## or ###
    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)[0].length;
      const content = trimmed.replace(/^#+\s/, '');
      const cls = level === 1
        ? 'text-xl font-bold tracking-[-0.02em] text-foreground mt-6 mb-2 first:mt-0'
        : level === 2
        ? 'text-lg font-semibold tracking-[-0.01em] text-foreground mt-5 mb-1.5 first:mt-0'
        : 'text-base font-semibold text-foreground mt-4 mb-1 first:mt-0';
      elements.push(<p key={i} className={cls}>{inlineRender(content, `h${i}`)}</p>);
      i++; continue;
    }

    // Bullet lines: •, -, *
    const bulletMatch = trimmed.match(/^(•|-|\*)\s(.+)/);
    if (bulletMatch) {
      const items = [];
      while (i < lines.length) {
        const bl = lines[i];
        const bt = bl.trim();
        const bm = bt.match(/^(•|-|\*)\s(.+)/);
        if (!bm) break;
        const bi = bl.match(/^(\s*)/)[1].length;
        items.push({ content: bm[2], indent: bi, idx: i });
        i++;
      }
      elements.push(
        <ul key={`ul${i}`} className="my-2 space-y-1">
          {items.map(item => (
            <li
              key={item.idx}
              className="flex gap-2 text-[0.9375rem] text-foreground leading-relaxed"
              style={{ paddingLeft: `${item.indent * 0.5}rem` }}
            >
              <span className="text-muted-foreground mt-0.5 shrink-0 select-none">•</span>
              <span>{inlineRender(item.content, `li${item.idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={i} className="border-border my-4" />);
      i++; continue;
    }

    // Empty line → spacing
    if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-[0.9375rem] text-foreground leading-relaxed">
        {inlineRender(trimmed, `p${i}`)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ── Prose viewer ──────────────────────────────────────────────────────────────
function ProseViewer({ label, value, allEntities, navigate, onEdit }) {
  const hasContent = value && value.trim();
  const rendered = useMemo(
    () => hasContent ? renderMarkdown(value, allEntities, navigate) : null,
    [value, allEntities] // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <div
      className="group -mx-3 rounded-lg px-3 py-2 cursor-text transition-colors hover:bg-accent/40"
      onClick={onEdit}
      title="Click to edit"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-muted-foreground">
          <Pencil size={11} /> Edit
        </span>
      </div>
      <div className="min-h-[1.5rem]">
        {rendered ?? <p className="text-sm text-muted-foreground/60">Nothing written yet. Click to add.</p>}
      </div>
    </div>
  );
}

// ── Custom Select ─────────────────────────────────────────────────────────────
function CustomSelect({ value, options, onChange, placeholder = '— Select —' }) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownH = Math.min(options.length * 38 + 44, 300);
      if (spaceBelow < dropdownH && rect.top > dropdownH) {
        setDropdownStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width, top: 'auto' });
      } else {
        setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    }
    setOpen(o => !o);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="input flex items-center justify-between gap-2 text-left hover:bg-accent"
      >
        <span className={`truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>{value || placeholder}</span>
        <ChevronDown size={13} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div style={{ ...dropdownStyle, zIndex: 9999 }} className="bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1 overflow-y-auto max-h-72 animate-menu">
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent transition-colors"
          >— None —</button>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors ${value === opt ? 'font-medium text-foreground bg-accent/60' : 'text-foreground'}`}
            >{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Prose Editor with toolbar ─────────────────────────────────────────────────
function ProseEditor({ label, value, onChange, placeholder, rows = 4 }) {
  const editorRef    = useRef(null);
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

  // Restore pending caret
  useEffect(() => {
    if (pendingCaret.current === null) return;
    const el = editorRef.current;
    if (!el) return;
    const off = pendingCaret.current;
    pendingCaret.current = null;
    requestAnimationFrame(() => { if (editorRef.current) setCaretOffset(editorRef.current, off); });
  });

  const commitText = useCallback((text, caret) => {
    const el = editorRef.current;
    if (!el) return;
    const html = render(text);
    if (el.innerHTML !== html) {
      el.innerHTML = html;
      pendingCaret.current = caret;
    }
    onChange(text);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (composing.current) return;
    const el = editorRef.current;
    if (!el) return;
    const raw = serializeNode(el).replace(/\n$/, '');
    const caret = getCaretOffset(el);
    commitText(raw, caret);
  }, [commitText]);

  // Toolbar helpers — work on plain text via caret offset
  const insertAtCaret = useCallback((before, after = '') => {
    const el = editorRef.current;
    if (!el) return;
    const pos = getCaretOffset(el);
    const sel = window.getSelection();
    let selText = '';
    if (sel && !sel.isCollapsed) {
      selText = sel.toString();
    }
    const text = serializeNode(el).replace(/\n$/, '');
    // Find selection in plain text
    const selLen = selText.length;
    const start = pos - selLen;
    const next = text.slice(0, start) + before + selText + after + text.slice(pos);
    const newCaret = start + before.length + selLen + after.length;
    commitText(next, newCaret);
  }, [commitText]);

  const wrapLine = useCallback((prefix) => {
    const el = editorRef.current;
    if (!el) return;
    const pos = getCaretOffset(el);
    const text = serializeNode(el).replace(/\n$/, '');
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd === -1 ? text.length : lineEnd;
    const line = text.slice(lineStart, end);
    const alreadyHas = line.startsWith(prefix);
    const newLine = alreadyHas ? line.slice(prefix.length) : prefix + line;
    const next = text.slice(0, lineStart) + newLine + text.slice(end);
    const newCaret = lineStart + newLine.length;
    commitText(next, newCaret);
  }, [commitText]);

  const handleKeyDown = useCallback((e) => {
    const el = editorRef.current;
    if (!el) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const pos = getCaretOffset(el);
      const text = serializeNode(el).replace(/\n$/, '');
      const before = text.slice(0, pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.slice(lineStart);
      const bulletMatch = currentLine.match(/^(\s*)([-*•]\s)/);
      if (bulletMatch) {
        const indent = bulletMatch[1];
        const bullet = bulletMatch[2];
        if (currentLine.trim() === bullet.trim()) {
          const next = text.slice(0, lineStart) + text.slice(pos);
          commitText(next, lineStart);
        } else {
          const insert = '\n' + indent + bullet;
          const next = text.slice(0, pos) + insert + text.slice(pos);
          commitText(next, pos + insert.length);
        }
        return;
      }
      const next = text.slice(0, pos) + '\n' + text.slice(pos);
      commitText(next, pos + 1);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const pos = getCaretOffset(el);
      const text = serializeNode(el).replace(/\n$/, '');
      const next = text.slice(0, pos) + '  ' + text.slice(pos);
      commitText(next, pos + 2);
    }

    if (e.key === ' ') {
      const pos = getCaretOffset(el);
      const text = serializeNode(el).replace(/\n$/, '');
      const before = text.slice(0, pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.slice(lineStart);
      if (currentLine === '-' || currentLine === '*') {
        e.preventDefault();
        const next = text.slice(0, lineStart) + '• ' + text.slice(pos);
        commitText(next, lineStart + 2);
      }
    }
  }, [commitText]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const el = editorRef.current;
    if (!el) return;
    const text = e.clipboardData.getData('text/plain');
    const caret = getCaretOffset(el);
    const current = serializeNode(el).replace(/\n$/, '');
    const next = current.slice(0, caret) + text + current.slice(caret);
    commitText(next, caret + text.length);
  }, [commitText]);

  const handleCompositionStart = useCallback(() => { composing.current = true; }, []);
  const handleCompositionEnd   = useCallback(() => { composing.current = false; handleInput(); }, [handleInput]);

  const minH = `${rows * 1.75 + 1.5}rem`;

  return (
    <div className="rounded-lg border border-input bg-background overflow-hidden transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
      <div className="flex items-center gap-0.5 px-1.5 h-9 border-b border-border bg-surface">
        <span className="text-xs font-medium text-muted-foreground px-1.5 mr-1 select-none">{label}</span>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn icon={Bold}      title="Bold (**text**)"  onClick={() => insertAtCaret('**', '**')} />
        <ToolbarBtn icon={Italic}    title="Italic (*text*)"  onClick={() => insertAtCaret('*', '*')} />
        <ToolbarBtn icon={Heading2}  title="Heading (## )"    onClick={() => wrapLine('## ')} />
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn icon={List}      title="Bullet (• )"      onClick={() => wrapLine('• ')} />
        <ToolbarBtn icon={AlignLeft} title="Indent"           onClick={() => wrapLine('  ')} />
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground/60 select-none pr-1.5 hidden md:block">- + space → bullet</span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        autoFocus
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        data-placeholder={placeholder}
        className="w-full bg-transparent text-sm text-foreground px-3.5 py-3 focus:outline-none leading-relaxed font-mono-prose"
        style={{ minHeight: minH, whiteSpace: 'pre-wrap', wordBreak: 'break-word', outline: 'none' }}
      />
    </div>
  );
}

function ToolbarBtn({ icon: Icon, title, onClick }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      <Icon size={14} />
    </button>
  );
}

// ── InfoField editor ──────────────────────────────────────────────────────────
function InfoFieldEditor({ field, value, onChange, values = {} }) {
  const races    = useWorldStore(s => s.races);
  const factions = useWorldStore(s => s.factions);

  if (field.type === 'select') {
    return <CustomSelect value={value} options={field.options} onChange={onChange} placeholder="Not set" />;
  }
  if (field.type === 'race-select') {
    const options = races.map(r => r.name).filter(Boolean).sort();
    return <CustomSelect value={value} options={options} onChange={onChange} placeholder="Not set" />;
  }
  if (field.type === 'faction-rank-select') {
    // If there's an issuedBy value, prefer levels from that specific faction.
    // Otherwise gather level titles from all factions whose name contains the hint.
    const hint = field.factionHint || '';
    let sourceFactions = [];
    if (values.issuedBy) {
      const named = factions.find(f => f.name?.toLowerCase() === values.issuedBy.toLowerCase());
      if (named) sourceFactions = [named];
    }
    if (!sourceFactions.length) {
      sourceFactions = factions.filter(f => f.name?.toLowerCase().includes(hint));
    }
    if (!sourceFactions.length) sourceFactions = factions;
    const levels = sourceFactions.flatMap(f => Array.isArray(f.membership) ? f.membership : []);
    const options = [...new Set(levels.map(l => l.title).filter(Boolean))];
    return <CustomSelect value={value} options={options} onChange={onChange} placeholder="Not set" />;
  }

  if (field.key === 'age') {
    const raceName = values.race;
    const raceData = raceName ? races.find(r => r.name === raceName) : null;
    const maxAge = raceData?.maxAge?.trim();
    const numericMax = maxAge ? parseInt(maxAge, 10) : null;
    const numericAge = value ? parseInt(value, 10) : null;
    const isAgeless = maxAge && isNaN(parseInt(maxAge, 10));
    const isOver = numericMax && numericAge && numericAge > numericMax;

    return (
      <div>
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          className={`input ${isOver ? '!border-amber-500/60' : ''}`}
        />
        {raceData && maxAge && !isAgeless && (
          <p className={`text-[11px] mt-1.5 ${isOver ? 'text-amber-400' : 'text-muted-foreground/60'}`}>
            {isOver
              ? `Exceeds typical ${raceName} lifespan (max ${maxAge})`
              : `${raceName} lifespan: 1–${maxAge}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder="—"
      className="input"
    />
  );
}

// ── Tag editor ────────────────────────────────────────────────────────────────
function TagEditor({ value = [], onChange }) {
  const [input, setInput] = useState('');
  const tags = Array.isArray(value) ? value : [];
  const add  = () => { const t = input.trim(); if (t && !tags.includes(t)) onChange([...tags, t]); setInput(''); };
  const remove = t => onChange(tags.filter(x => x !== t));
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border text-xs text-foreground">
            {t}
            <button onClick={() => remove(t)} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
              <X size={9} />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet</span>}
      </div>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder="Add tag… (Enter or comma)"
          className="input flex-1"
        />
        <button onClick={add} className="btn btn-outline">
          Add
        </button>
      </div>
    </div>
  );
}

// ── Character Select (multi-pick from character list) ─────────────────────────
function CharacterSelectField({ value = [], onChange, readOnly = false }) {
  const characters = useWorldStore(s => s.characters);
  const navigate   = useNavigate();
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef(null);
  const btnRef = useRef(null);
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (charId) => {
    if (selected.includes(charId)) onChange(selected.filter(id => id !== charId));
    else onChange([...selected, charId]);
  };

  const { selectedChars, unselected } = useMemo(() => {
    const s = characters.filter(c => selected.includes(c.id));
    const u = characters.filter(c => !selected.includes(c.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return { selectedChars: s, unselected: u };
  }, [characters, selected]);

  if (readOnly) {
    if (!selectedChars.length) return <p className="text-sm text-muted-foreground">No members assigned</p>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {selectedChars.map(c => (
          <button
            key={c.id}
            onClick={() => navigate(`/characters/${c.id}`)}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            {c.name || 'Unnamed'}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-2">
      {selectedChars.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedChars.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs font-medium text-foreground">
              {c.name || 'Unnamed'}
              <button onClick={() => toggle(c.id)} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <button
          ref={btnRef}
          onClick={() => {
            if (!open && btnRef.current) {
              const rect = btnRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const dropH = Math.min(unselected.length * 36 + 8, 220);
              if (spaceBelow < dropH && rect.top > dropH) {
                setDropdownStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: 224, top: 'auto' });
              } else {
                setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: 224 });
              }
            }
            setOpen(o => !o);
          }}
          className="btn btn-outline btn-sm"
        >
          <Plus size={11} /> Add character
        </button>
        {open && (
          <div style={{ ...dropdownStyle, zIndex: 9999 }} className="bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1 overflow-hidden animate-menu">
            <div className="max-h-52 overflow-y-auto">
              {unselected.length === 0
                ? <p className="text-xs text-muted-foreground px-2 py-1.5">All characters added</p>
                : unselected.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { toggle(c.id); setOpen(false); }}
                    className="w-full text-left rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {c.name || 'Unnamed'}
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Thing Select (multi-pick from things list) ─────────────────────────
function ThingSelectField({ value = [], onChange, readOnly = false }) {
  const things = useWorldStore(s => s.things);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef(null);
  const btnRef = useRef(null);
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (thingId) => {
    if (selected.includes(thingId)) onChange(selected.filter(id => id !== thingId));
    else onChange([...selected, thingId]);
  };

  const { selectedThings, unselected } = useMemo(() => {
    const s = things.filter(t => selected.includes(t.id));
    const u = things.filter(t => !selected.includes(t.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return { selectedThings: s, unselected: u };
  }, [things, selected]);

  if (readOnly) {
    if (!selectedThings.length) return <p className="text-sm text-muted-foreground">No items assigned</p>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {selectedThings.map(t => (
          <button
            key={t.id}
            onClick={() => navigate(`/things/${t.id}`)}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            {t.name || 'Unnamed'}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-2">
      {selectedThings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedThings.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs font-medium text-foreground">
              {t.name || 'Unnamed'}
              <button onClick={() => toggle(t.id)} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <button
          ref={btnRef}
          onClick={() => {
            if (!open && btnRef.current) {
              const rect = btnRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const dropH = Math.min(unselected.length * 36 + 8, 220);
              if (spaceBelow < dropH && rect.top > dropH) {
                setDropdownStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: 224, top: 'auto' });
              } else {
                setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: 224 });
              }
            }
            setOpen(o => !o);
          }}
          className="btn btn-outline btn-sm"
        >
          <Plus size={11} /> Add thing
        </button>
        {open && (
          <div style={{ ...dropdownStyle, zIndex: 9999 }} className="bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1 overflow-hidden animate-menu">
            <div className="max-h-52 overflow-y-auto">
              {unselected.length === 0
                ? <p className="text-xs text-muted-foreground px-2 py-1.5">All things added</p>
                : unselected.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { toggle(t.id); setOpen(false); }}
                    className="w-full text-left rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {t.name || 'Unnamed'}
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-races editor ──────────────────────────────────────────────────────────
function SubracesEditor({ value = [], onChange, readOnly = false }) {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e, idx) => {
    dragItem.current = idx;
    setIsDragging(true);
  };
  const handleDragEnter = (e, idx) => {
    dragOverItem.current = idx;
  };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const _levels = [...levels];
      const dragged = _levels.splice(dragItem.current, 1)[0];
      _levels.splice(dragOverItem.current, 0, dragged);
      onChange(_levels);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setIsDragging(false);
  };

  const levels = Array.isArray(value) ? value : [];

  const addLevel = () => onChange([...levels, { id: crypto.randomUUID(), title: '', description: '', traits: '' }]);

  const updateLevel = (idx, patch) => {
    const next = levels.map((l, i) => i === idx ? { ...l, ...patch } : l);
    onChange(next);
  };

  const removeLevel = (idx) => onChange(levels.filter((_, i) => i !== idx));

  const moveLevelUp = (idx) => {
    if (idx === 0) return;
    const next = [...levels];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const moveLevelDown = (idx) => {
    if (idx === levels.length - 1) return;
    const next = [...levels];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };

  if (readOnly) {
    if (!levels.length) return <p className="text-sm text-muted-foreground">No sub-races defined</p>;
    return (
      <div className="space-y-3">
        {levels.map((level, idx) => (
          <div key={level.id || idx} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-surface border-b border-border">
              <span className="text-sm font-semibold text-foreground">{level.title || 'Untitled Sub-race'}</span>
            </div>
            <div className="px-3 py-2.5 space-y-3">
              {level.description && (
                <div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{level.description}</p>
                </div>
              )}
              {level.traits && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Traits & Abilities</p>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{level.traits}</p>
                </div>
              )}
              {!level.description && !level.traits && (
                <p className="text-xs text-muted-foreground/70">No details</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {levels.map((level, idx) => (
        <div 
          key={level.id || idx} 
          className="rounded-lg border border-border bg-card overflow-hidden"
          draggable
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragEnter={(e) => handleDragEnter(e, idx)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border">
            <input
              value={level.title}
              onChange={e => updateLevel(idx, { title: e.target.value })}
              placeholder="Sub-race / Variant Name (e.g. Drow)"
              className="flex-1 text-sm font-semibold bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/40 placeholder:font-normal"
            />
            <div className="flex items-center gap-1 shrink-0">
              <div className="cursor-grab text-muted-foreground/60 hover:text-foreground transition-colors px-1" title="Drag to reorder">
                <GripVertical size={14} />
              </div>
              <button onClick={() => removeLevel(idx)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="px-3 py-2.5 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Description</p>
              <TextareaAutosize
                value={level.description || ''}
                onChange={e => updateLevel(idx, { description: e.target.value })}
                placeholder="Describe the culture, appearance, or lore of this variant..."
                minRows={3}
                className="input h-auto py-2 leading-relaxed resize-none"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Traits & Abilities</p>
              <TextareaAutosize
                value={level.traits || ''}
                onChange={e => updateLevel(idx, { traits: e.target.value })}
                placeholder="Specific mechanics or innate abilities..."
                minRows={2}
                className="input h-auto py-2 leading-relaxed resize-none"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={addLevel}
        className="btn btn-outline btn-sm w-full"
      >
        <Plus size={14} /> Add Sub-race
      </button>
    </div>
  );
}

// ── Membership Levels editor ──────────────────────────────────────────────────
function MembershipLevelsEditor({ value = [], onChange, readOnly = false }) {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e, idx) => {
    dragItem.current = idx;
    setIsDragging(true);
  };
  const handleDragEnter = (e, idx) => {
    dragOverItem.current = idx;
  };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const _levels = [...levels];
      const dragged = _levels.splice(dragItem.current, 1)[0];
      _levels.splice(dragOverItem.current, 0, dragged);
      onChange(_levels);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setIsDragging(false);
  };

  const characters = useWorldStore(s => s.characters);
  const navigate   = useNavigate();
  const levels = Array.isArray(value) ? value : [];

  const addLevel = () => onChange([...levels, { id: crypto.randomUUID(), title: '', members: [], benefits: '' }]);

  const updateLevel = (idx, patch) => {
    const next = levels.map((l, i) => i === idx ? { ...l, ...patch } : l);
    onChange(next);
  };

  const removeLevel = (idx) => onChange(levels.filter((_, i) => i !== idx));

  const moveLevelUp = (idx) => {
    if (idx === 0) return;
    const next = [...levels];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const moveLevelDown = (idx) => {
    if (idx === levels.length - 1) return;
    const next = [...levels];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };

  const toggleMember = (idx, charId) => {
    const l = levels[idx];
    const next = l.members.includes(charId)
      ? l.members.filter(id => id !== charId)
      : [...l.members, charId];
    updateLevel(idx, { members: next });
  };

  if (readOnly) {
    if (!levels.length) return <p className="text-sm text-muted-foreground">No membership levels defined</p>;
    return (
      <div className="space-y-3">
        {levels.map((level, idx) => {
          const memberChars = characters.filter(c => (level.members || []).includes(c.id));
          return (
            <div key={level.id || idx} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 bg-surface border-b border-border">
                <span className="text-[0.8125rem] font-semibold text-foreground">{level.title || 'Untitled Level'}</span>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {memberChars.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {memberChars.map(c => (
                      <button key={c.id} onClick={() => navigate(`/characters/${c.id}`)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors">
                        {c.name || 'Unnamed'}
                      </button>
                    ))}
                  </div>
                )}
                {level.benefits && (
                  <p className="text-[0.8125rem] text-foreground/90 leading-relaxed whitespace-pre-wrap">{level.benefits}</p>
                )}
                {!memberChars.length && !level.benefits && (
                  <p className="text-xs text-muted-foreground/70">No details</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {levels.map((level, idx) => {
        const assignedChars = characters.filter(c => (level.members || []).includes(c.id));
        const unassigned    = characters.filter(c => !(level.members || []).includes(c.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return (
          <div 
            key={level.id || idx} 
            className="rounded-lg border border-border bg-card overflow-hidden"
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragEnter={(e) => handleDragEnter(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border">
              <input
                value={level.title}
                onChange={e => updateLevel(idx, { title: e.target.value })}
                placeholder="Level title (e.g. Initiate)"
                className="flex-1 text-xs font-semibold bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/40 placeholder:font-normal"
              />
              <div className="flex items-center gap-1 shrink-0">
                <div className="cursor-grab text-muted-foreground/60 hover:text-foreground transition-colors px-1" title="Drag to reorder">
                  <GripVertical size={14} />
                </div>
                <button onClick={() => removeLevel(idx)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="px-3 py-2.5 space-y-2.5">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Members at this rank</p>
                <CharacterSelectField
                  value={level.members || []}
                  onChange={members => updateLevel(idx, { members })}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Benefits & privileges</p>
                <TextareaAutosize
                  value={level.benefits || ''}
                  onChange={e => updateLevel(idx, { benefits: e.target.value })}
                  placeholder="What does this rank grant?"
                  minRows={2}
                  className="input h-auto py-2 leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>
        );
      })}
      <button
        onClick={addLevel}
        className="btn btn-outline btn-sm w-full"
      >
        <Plus size={11} /> Add membership level
      </button>
    </div>
  );
}

// ── Relationships panel ───────────────────────────────────────────────────────
function RelationshipsPanel({ entityId, entityType }) {
  const navigate           = useNavigate();
  const relationships      = useWorldStore(s => s.relationships);
  const addRelationship    = useWorldStore(s => s.addRelationship);
  const deleteRelationship = useWorldStore(s => s.deleteRelationship);
  const addEntity          = useWorldStore(s => s.addEntity);
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);

  const [adding, setAdding]     = useState(false);
  const [label, setLabel]       = useState('');
  const [targetId, setTargetId] = useState('');

  const allEntities = [
    ...characters.map(e => ({ ...e, _type: 'characters' })),
    ...locations.map(e  => ({ ...e, _type: 'locations'  })),
    ...things.map(e     => ({ ...e, _type: 'things'     })),
    ...factions.map(e   => ({ ...e, _type: 'factions'   })),
    ...creatures.map(e  => ({ ...e, _type: 'creatures'  })),
    ...lore.filter(e => !e._isTimelineEvent).map(e => ({ ...e, _type: 'lore' })),
  ].filter(e => !(e.id === entityId && e._type === entityType));

  const myRels    = relationships.filter(r => r.fromId === entityId || r.toId === entityId);
  const getEntity = (id, type) => ({ characters, locations, things, factions, creatures, lore }[type] || []).find(e => e.id === id);

  const handleAdd = async () => {
    if (!targetId || !label.trim()) return;
    const target = allEntities.find(e => e.id === targetId);
    if (!target) return;
    await addRelationship(entityId, entityType, targetId, target._type, label.trim());
    setLabel(''); setTargetId(''); setAdding(false);
  };

  const handleCreateVariant = async () => {
    const baseEntity = getEntity(entityId, entityType);
    if (!baseEntity) return;

    // Count existing variants to determine the number
    const variantCount = myRels.filter(r => r.label === 'Variant of' && r.toId === entityId).length + 1;

    // Copy all properties except ID
    const newEntityData = { ...baseEntity, name: `${baseEntity.name || 'Unknown'} Variant ${variantCount}` };
    delete newEntityData.id;

    const created = await addEntity(entityType, newEntityData);
    await addRelationship(created.id, entityType, entityId, entityType, 'Variant of');
    navigate(`/${entityType}/${created.id}`, { state: { autoEdit: true } });
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 h-10 border-b border-border flex items-center justify-between">
        <h3 className="text-[0.8125rem] font-semibold text-foreground">Connections</h3>
        <div className="flex items-center gap-1">
          <button onClick={handleCreateVariant} title="Create a variant of this entity" className="btn btn-ghost btn-sm">
            <Plus size={11} />
            <span>Variant</span>
          </button>
          <button onClick={() => setAdding(a => !a)} title="Link existing entity" className="btn btn-ghost btn-icon btn-sm">
            <Link2 size={13} />
          </button>
        </div>
      </div>

      {adding && (
        <div className="px-4 py-3 border-b border-border space-y-2 bg-surface">
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Describe the connection…"
            className="input"
          />
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="input pr-8"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '2rem' }}
          >
            <option value="">Select entity…</option>
            {allEntities.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e._type.slice(0, -1)})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn btn-primary flex-1">Add</button>
            <button onClick={() => { setAdding(false); setLabel(''); setTargetId(''); }} className="btn btn-outline flex-1">Cancel</button>
          </div>
        </div>
      )}

      {myRels.length === 0 && !adding ? (
        <button onClick={() => setAdding(true)} className="w-full px-4 py-4 text-[0.8125rem] text-muted-foreground hover:bg-accent/40 transition-colors text-center">
          No connections yet — click + to add one
        </button>
      ) : (
        <div className="divide-y divide-border">
          {myRels.map(rel => {
            const isFrom    = rel.fromId === entityId;
            const otherId   = isFrom ? rel.toId   : rel.fromId;
            const otherType = isFrom ? rel.toType : rel.fromType;
            const other     = getEntity(otherId, otherType);
            if (!other) return null;
            return (
              <div key={rel.id} className="flex items-center gap-2 px-4 py-2.5 group">
                <Link2 size={13} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[0.8125rem] text-muted-foreground">{rel.label} </span>
                  <button onClick={() => navigate(`/${otherType}/${otherId}`)} className="text-[0.8125rem] font-medium text-foreground hover:underline">
                    {other.name}
                  </button>
                </div>
                <button onClick={() => deleteRelationship(rel.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all rounded hover:bg-destructive/10">
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Appears In panel ──────────────────────────────────────────────────────────
function AppearsIn({ entityName }) {
  const navigate = useNavigate();
  const stories  = useWorldStore(s => s.stories);

  const mentions = useMemo(() => {
    const name = (entityName || '').trim();
    if (!name) return [];
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const chipRe = new RegExp(`\\[\\[${escaped}\\]\\]`, 'g');
    return stories
      .map(s => {
        const text = (s.content || '').replace(/\f/g, ' ');
        const matches = text.match(chipRe);
        const count = matches ? matches.length : 0;
        return count > 0 ? { ...s, _count: count } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b._count - a._count);
  }, [stories, entityName]);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 h-10 border-b border-border flex items-center justify-between">
        <h3 className="text-[0.8125rem] font-semibold text-foreground">Appears In</h3>
        {mentions.length > 0 && (
          <span className="text-xs text-muted-foreground">{mentions.length} {mentions.length === 1 ? 'story' : 'stories'}</span>
        )}
      </div>
      {mentions.length === 0 ? (
        <p className="px-4 py-4 text-[0.8125rem] text-muted-foreground text-center">Not mentioned in any stories yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {mentions.map(s => (
            <button key={s.id} onClick={() => navigate(`/stories/${s.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/60 transition-colors group">
              <BookOpen size={14} className="text-muted-foreground shrink-0" />
              <span className="flex-1 text-[0.8125rem] font-medium text-foreground truncate">{s.name}</span>
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground tabular-nums">{s._count}×</span>
              <ExternalLink size={11} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Fields scanned for [[Name]] backlinks (module-level so dependency lists stay stable).
const BACKLINK_WIKI_FIELDS = [
  'description', 'background', 'personality', 'appearance', 'history', 'atmosphere', 'notes',
  'origin', 'abilities', 'weaknesses', 'motivation', 'goals', 'doctrine', 'culture',
  'behavior', 'diet', 'habitat', 'resources', 'membership', 'secrets', 'content',
];

const BACKLINK_TYPE_COLORS = {
  characters: 'text-blue-400',
  locations:  'text-green-400',
  things:     'text-amber-400',
  lore:       'text-purple-400',
  factions:   'text-indigo-400',
  creatures:  'text-orange-400',
  stories:    'text-brand',
  maps:       'text-emerald-400',
};

// ── Backlinks panel ───────────────────────────────────────────────────────────
function Backlinks({ entityId, entityName, entityType }) {
  const navigate    = useNavigate();
  const characters  = useWorldStore(s => s.characters);
  const locations   = useWorldStore(s => s.locations);
  const things      = useWorldStore(s => s.things);
  const lore        = useWorldStore(s => s.lore);
  const factions    = useWorldStore(s => s.factions);
  const creatures   = useWorldStore(s => s.creatures);
  const stories     = useWorldStore(s => s.stories);
  const maps        = useWorldStore(s => s.maps);

  const chipRe = useMemo(() => {
    const name = (entityName || '').trim();
    if (!name) return null;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\[\\[${esc}\\]\\]`, 'i');
  }, [entityName]);

  const rows = useMemo(() => {
    if (!chipRe || !entityName?.trim()) return [];
    const out = [];
    const pushWiki = (e, type, kindLabel) => {
      if (e.id === entityId && type === entityType) return;
      const hit = BACKLINK_WIKI_FIELDS.some(k => chipRe.test(e[k] || ''));
      if (hit) out.push({ key: `${type}-${e.id}`, kindLabel, type, entityId: e.id, name: e.name });
    };

    characters.forEach(e => pushWiki(e, 'characters', 'Character'));
    locations.forEach(e => pushWiki(e, 'locations', 'Location'));
    things.forEach(e => pushWiki(e, 'things', 'Thing'));
    lore.filter(e => !e._isTimelineEvent).forEach(e => pushWiki(e, 'lore', 'Lore'));
    factions.forEach(e => pushWiki(e, 'factions', 'Faction'));
    creatures.forEach(e => pushWiki(e, 'creatures', 'Creature'));

    for (const s of stories) {
      if (chipRe.test(s.content || '')) {
        out.push({ key: `story-${s.id}`, kindLabel: 'Story', type: 'stories', name: s.name, storyId: s.id });
      }
    }

    for (const m of maps) {
      const pinHit = (m.pins || []).some(p => p.entityId === entityId);
      const protoHit = m.protagonist?.entityId === entityId;
      if (pinHit || protoHit) {
        out.push({ key: `map-${m.id}`, kindLabel: 'Map', type: 'maps', name: m.name || 'Map', mapId: m.id });
      }
    }

    return out;
  }, [characters, locations, things, lore, factions, creatures, stories, maps, chipRe, entityName, entityId, entityType]);

  if (rows.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="text-[0.8125rem] font-semibold text-foreground">Mentioned in</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Wiki text, chapters, and map pins referencing <strong className="font-medium text-foreground">{entityName}</strong></p>
      </div>
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {rows.map(r => (
          <button
            key={r.key}
            onClick={() => {
              if (r.storyId) navigate(`/stories/${r.storyId}`);
              else if (r.mapId) navigate(`/maps/${r.mapId}`);
              else navigate(`/${r.type}/${r.entityId}`);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/60 transition-colors group"
          >
            <span className={`w-16 shrink-0 text-xs font-medium ${BACKLINK_TYPE_COLORS[r.type] || 'text-muted-foreground'}`}>{r.kindLabel}</span>
            <span className="flex-1 text-[0.8125rem] font-medium text-foreground truncate">{r.name}</span>
            <ExternalLink size={11} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mini graph panel ──────────────────────────────────────────────────────────
function MiniGraph({ entityId, entityType, entityName, allEntities }) {
  const navigate      = useNavigate();
  const relationships = useWorldStore(s => s.relationships);
  const stories       = useWorldStore(s => s.stories);

  const NODE_COLORS = {
    characters: '#60a5fa',
    locations:  '#34d399',
    things:     '#fbbf24',
    lore:       '#a78bfa',
    stories:    '#c084fc',
  };

  const graph = useMemo(() => {
    const myRels = relationships.filter(r => r.fromId === entityId || r.toId === entityId);
    const connectedIds = new Set();
    myRels.forEach(r => { connectedIds.add(r.fromId); connectedIds.add(r.toId); });

    // Also find story-mention edges
    const nameLC = entityName.toLowerCase();
    const mentionStories = stories.filter(s => (s.content || '').toLowerCase().includes(nameLC));
    mentionStories.forEach(s => connectedIds.add(s.id));
    connectedIds.delete(entityId);

    const nodes = [
      { id: entityId, type: entityType, name: entityName, isCenter: true },
    ];
    for (const id of connectedIds) {
      const found = allEntities.find(e => e.id === id) || stories.find(s => s.id === id);
      if (found) {
        nodes.push({ id, type: found._type || 'stories', name: found.name, isCenter: false });
      }
    }

    const edges = [
      ...myRels.map(r => ({ source: r.fromId, target: r.toId, label: r.label, kind: 'rel' })),
      ...mentionStories.map(s => ({ source: entityId, target: s.id, kind: 'mention' })),
    ];

    return { nodes, edges };
  }, [relationships, stories, entityId, entityType, entityName, allEntities]);

  if (graph.nodes.length <= 1) return null;

  const W = 280, H = 180;
  const cx = W / 2, cy = H / 2;
  const others = graph.nodes.filter(n => !n.isCenter);
  const positions = {};
  positions[entityId] = { x: cx, y: cy };
  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
    const r = Math.min(W, H) * 0.35;
    positions[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <div className="card overflow-hidden">
      <div className="px-4 h-10 border-b border-border flex items-center justify-between">
        <h3 className="text-[0.8125rem] font-semibold text-foreground flex items-center gap-1.5">
          <Network size={11} /> Connections
        </h3>
      </div>
      <div className="p-2">
        <svg width={W} height={H} className="overflow-visible">
          {graph.edges.map((e, i) => {
            const s = positions[e.source], t = positions[e.target];
            if (!s || !t) return null;
            return (
              <line
                key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={e.kind === 'rel' ? 'rgba(148,163,184,0.5)' : 'rgba(148,163,184,0.2)'}
                strokeWidth={e.kind === 'rel' ? 1.5 : 1}
                strokeDasharray={e.kind === 'mention' ? '3 3' : undefined}
              />
            );
          })}
          {graph.nodes.map(n => {
            const pos = positions[n.id];
            if (!pos) return null;
            const color = NODE_COLORS[n.type] || '#94a3b8';
            const r = n.isCenter ? 9 : 6;
            const path = n.type === 'stories' ? `/stories/${n.id}` : `/${n.type}/${n.id}`;
            return (
              <g key={n.id} onClick={() => !n.isCenter && navigate(path)} className={n.isCenter ? '' : 'cursor-pointer'}>
                <circle cx={pos.x} cy={pos.y} r={r} fill={color} fillOpacity={n.isCenter ? 0.9 : 0.6} stroke={color} strokeWidth={n.isCenter ? 2 : 1} />
                {!n.isCenter && (
                  <text x={pos.x} y={pos.y + r + 10} textAnchor="middle" fontSize={8} fill="rgba(148,163,184,0.8)" className="pointer-events-none select-none">
                    {n.name.length > 12 ? n.name.slice(0, 12) + '…' : n.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Inventory Panel ───────────────────────────────────────────────────────────
const INVENTORY_LOCATIONS = [
  { key: 'on_hand', label: 'On Hand',  icon: Backpack,  color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  { key: 'house',   label: 'House',    icon: Home,       color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  { key: 'bank',    label: 'Bank',     icon: Landmark,   color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
  { key: 'other',   label: 'Other',    icon: Package,    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
];

const RARITY_STYLES = {
  Common:    'text-muted-foreground   border-border/60',
  Uncommon:  'text-green-400          border-green-500/30',
  Rare:      'text-blue-400           border-blue-500/30',
  Legendary: 'text-amber-400          border-amber-500/30',
  Unique:    'text-purple-400         border-purple-500/30',
};

const RARITY_NAME_COLOR = {
  Common:    'text-foreground',
  Uncommon:  'text-green-400',
  Rare:      'text-blue-400',
  Legendary: 'text-amber-400',
  Unique:    'text-purple-400',
};

const ITEM_TYPES = ['Item', 'Weapon', 'Armor', 'Artifact', 'Potion'];

function ItemNameInput({ value, onChange, onSelectThing, onCreateThing, things }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const itemThings = things.filter(t => ITEM_TYPES.includes(t.type));
  const query = value.toLowerCase().trim();
  const filtered = query.length === 0 ? itemThings : itemThings.filter(t => t.name.toLowerCase().includes(query));
  const exactMatch = itemThings.some(t => t.name.toLowerCase() === query);
  const showDropdown = open && (filtered.length > 0 || (!exactMatch && value.trim()));

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const updatePosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 });
  };

  const handleFocus = () => { updatePosition(); setOpen(true); };
  const handleChange = e => { onChange(e.target.value); updatePosition(); setOpen(true); };

  const handleCreate = async () => {
    if (!value.trim() || creating) return;
    setCreating(true);
    await onCreateThing(value.trim());
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={wrapRef}>
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        placeholder="Item name…"
        className="input"
      />
      {showDropdown && (
        <div style={dropdownStyle} className="bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1 overflow-y-auto max-h-52 animate-menu">
          {filtered.slice(0, 8).map(t => (
            <button
              key={t.id}
              onMouseDown={e => { e.preventDefault(); onSelectThing(t); setOpen(false); }}
              className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent transition-colors"
            >
              <span className="text-xs font-medium text-foreground flex-1 truncate">{t.name}</span>
              {t.rarity && t.rarity !== 'Common' && (
                <span className={`text-[0.65rem] font-medium border rounded px-1 ${RARITY_STYLES[t.rarity] || ''}`}>{t.rarity}</span>
              )}
              {t.type && <span className="text-xs text-muted-foreground shrink-0">{t.type}</span>}
            </button>
          ))}
          {!exactMatch && value.trim() && (
            <button
              onMouseDown={e => { e.preventDefault(); handleCreate(); }}
              disabled={creating}
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent transition-colors"
            >
              <Plus size={13} className="text-brand shrink-0" />
              <span className="text-xs text-brand font-medium">Create "{value.trim()}" as a Thing</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InventoryPanel({ inventory = [], onChange }) {
  const navigate = useNavigate();
  const things        = useWorldStore(s => s.things);
  const addEntity     = useWorldStore(s => s.addEntity);

  const [activeTab, setActiveTab]   = useState('on_hand');
  const [adding, setAdding]         = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [collapsed, setCollapsed]   = useState(false);

  const [form, setForm] = useState({ name: '', qty: '1', rarity: 'Common', location: 'on_hand', notes: '', thingId: null });

  const items = Array.isArray(inventory) ? inventory : [];

  const resetForm = (loc = activeTab) => setForm({ name: '', qty: '1', rarity: 'Common', location: loc, notes: '', thingId: null });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: form.name.trim(),
      qty: parseInt(form.qty, 10) || 1,
      rarity: form.rarity || 'Common',
      location: form.location || 'on_hand',
      notes: form.notes.trim(),
      thingId: form.thingId || null,
    };
    onChange([...items, newItem]);
    resetForm(form.location);
    setAdding(false);
  };

  const handleSelectThing = (thing) => {
    setForm(f => ({
      ...f,
      name: thing.name,
      rarity: thing.rarity || f.rarity,
      notes: thing.description ? thing.description.slice(0, 120) : f.notes,
      thingId: thing.id,
    }));
  };

  const handleCreateThing = async (name) => {
    const created = await addEntity('things', { name, type: 'Item', rarity: form.rarity !== 'Common' ? form.rarity : undefined });
    setForm(f => ({ ...f, name: created.name, thingId: created.id }));
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name, qty: String(item.qty ?? 1), rarity: item.rarity || 'Common', location: item.location || 'on_hand', notes: item.notes || '', thingId: item.thingId || null });
  };

  const handleUpdate = () => {
    if (!form.name.trim()) return;
    onChange(items.map(it => it.id === editingId
      ? { ...it, name: form.name.trim(), qty: parseInt(form.qty, 10) || 1, rarity: form.rarity, location: form.location, notes: form.notes.trim(), thingId: form.thingId || null }
      : it
    ));
    setEditingId(null);
    resetForm();
  };

  const handleDelete = (id) => onChange(items.filter(it => it.id !== id));

  const handleQtyChange = (id, delta) => {
    onChange(items.map(it => it.id === id ? { ...it, qty: Math.max(0, (it.qty || 1) + delta) } : it));
  };

  const tabItems = items.filter(it => it.location === activeTab);
  const locMeta  = INVENTORY_LOCATIONS.find(l => l.key === activeTab);

  const totalCount = items.length;
  const tabCount   = tabItems.length;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 h-10 border-b border-border flex items-center justify-between">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <Package size={14} className="text-muted-foreground shrink-0" />
          <h3 className="text-[0.8125rem] font-semibold text-foreground">Inventory</h3>
          {totalCount > 0 && (
            <span className="ml-0.5 text-xs px-1.5 rounded-md bg-muted text-muted-foreground tabular-nums">{totalCount}</span>
          )}
          <ChevronDown size={11} className={`ml-auto text-muted-foreground shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        {!collapsed && (
          <button
            onClick={() => { setAdding(a => !a); setEditingId(null); resetForm(activeTab); }}
            className="btn btn-ghost btn-icon btn-sm ml-1"
            title="Add item"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Location tabs */}
          <div className="flex border-b border-border">
            {INVENTORY_LOCATIONS.map(loc => {
              const cnt  = items.filter(it => it.location === loc.key).length;
              return (
                <button
                  key={loc.key}
                  onClick={() => { setActiveTab(loc.key); setAdding(false); setEditingId(null); }}
                  className={`flex-1 flex items-center justify-center gap-1 h-9 px-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === loc.key
                      ? 'text-foreground border-foreground'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  <span className="whitespace-nowrap">{loc.label}</span>
                  {cnt > 0 && <span className="px-1 rounded bg-muted text-[0.65rem] tabular-nums text-muted-foreground">{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* Add / Edit form */}
          {(adding || editingId) && (
            <div className="px-3 py-3 border-b border-border bg-surface space-y-2">
              <ItemNameInput
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v, thingId: null }))}
                onSelectThing={handleSelectThing}
                onCreateThing={handleCreateThing}
                things={things}
              />
              {form.thingId && (() => {
                const linked = things.find(t => t.id === form.thingId);
                return linked ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Linked to</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/things/${form.thingId}`)}
                      className="text-xs text-brand hover:underline font-medium flex items-center gap-0.5"
                    >
                      {linked.name} <ExternalLink size={9} className="inline" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, thingId: null }))}
                      className="ml-auto text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      title="Unlink"
                    ><X size={10} /></button>
                  </div>
                ) : null;
              })()}
              <div className="flex gap-2">
                <div className="flex h-8 items-center gap-1.5 bg-background border border-input rounded-md px-2">
                  <Hash size={10} className="text-muted-foreground" />
                  <input
                    type="number" min="0"
                    value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                    className="w-12 bg-transparent text-sm text-foreground focus:outline-none text-center"
                  />
                </div>
                <select
                  value={form.rarity}
                  onChange={e => setForm(f => ({ ...f, rarity: e.target.value }))}
                  className="input flex-1 min-w-0 text-xs px-2"
                >
                  {Object.keys(RARITY_STYLES).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="input flex-1 min-w-0 text-xs px-2"
                >
                  {INVENTORY_LOCATIONS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)…"
                className="input text-xs"
              />
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={editingId ? handleUpdate : handleAdd}
                  className="btn btn-primary btn-sm flex-1"
                >
                  {editingId ? 'Update' : 'Add Item'}
                </button>
                <button
                  onClick={() => { setAdding(false); setEditingId(null); resetForm(); }}
                  className="btn btn-outline btn-sm flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Item list */}
          {tabItems.length === 0 ? (
            <button
              onClick={() => { setAdding(true); setEditingId(null); resetForm(activeTab); }}
              className="w-full px-4 py-4 text-[0.8125rem] text-muted-foreground hover:bg-accent/40 transition-colors text-center"
            >
              Nothing {locMeta?.label === 'On Hand' ? 'on hand' : `at ${locMeta?.label}`} — click + to add
            </button>
          ) : (
            <div className="divide-y divide-border">
              {tabItems.map(item => {
                const rarityClass = RARITY_STYLES[item.rarity] || RARITY_STYLES.Common;
                const isEditing   = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-3 py-2.5 group transition-colors hover:bg-accent/50 ${isEditing ? 'bg-accent/60' : ''}`}
                  >
                    {/* Qty controls */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleQtyChange(item.id, -1)}
                        className="w-4 h-4 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs leading-none flex items-center justify-center"
                      >−</button>
                      <span className="text-xs tabular-nums text-muted-foreground w-5 text-center">{item.qty ?? 1}</span>
                      <button
                        onClick={() => handleQtyChange(item.id, 1)}
                        className="w-4 h-4 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs leading-none flex items-center justify-center"
                      >+</button>
                    </div>

                    {/* Name & rarity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.thingId ? (
                          <button
                            onClick={() => navigate(`/things/${item.thingId}`)}
                            className={`text-xs font-medium hover:underline truncate ${RARITY_NAME_COLOR[item.rarity] || 'text-foreground'}`}
                          >{item.name}</button>
                        ) : (
                          <span className={`text-xs font-medium truncate ${RARITY_NAME_COLOR[item.rarity] || 'text-foreground'}`}>{item.name}</span>
                        )}
                        {item.rarity && item.rarity !== 'Common' && (
                          <span className={`text-[0.65rem] font-medium border rounded px-1 py-0 ${rarityClass}`}>{item.rarity}</span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Edit"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer summary */}
          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-surface flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {items.reduce((sum, it) => sum + (it.qty || 1), 0)} total items across all locations
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sidebar — view mode info display ─────────────────────────────────────────
function InfoView({ infoFields, values, memberCount = null }) {
  const filled = infoFields.filter(f => values[f.key]);
  if (filled.length === 0 && memberCount === null) return null;
  return (
    <div className="card overflow-hidden">
      <div className="px-4 h-10 flex items-center border-b border-border">
        <p className="text-[0.8125rem] font-semibold text-foreground">Properties</p>
      </div>
      <dl className="px-4 py-2">
        {memberCount !== null && (
          <PropertyRow label="Members">
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} className="text-muted-foreground" />
              {memberCount}
            </span>
          </PropertyRow>
        )}
        {filled.map(f => (
          <PropertyRow key={f.key} label={f.label}>
            {BADGE_FIELDS.includes(f.label)
              ? <StatusBadge value={String(values[f.key])} />
              : String(values[f.key])}
          </PropertyRow>
        ))}
      </dl>
    </div>
  );
}

export function EntityWikiContent() {
  const dndEnabled = useAppSettings(s => s.dndTools?.enabled);
  const location     = useLocation();
  const params       = useParams();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  let entityType     = params.entityType || pathSegments[0];
  let id             = params.id || pathSegments[1];

  if (entityType === 'custom') {
    entityType = 'customEntities';
    id = params.id || pathSegments[2];
  }

  const navigate     = useNavigate();

  const activeWorld               = useWorldStore(s => s.activeWorld);
  const entities                  = useWorldStore(s => s[entityType] || []);
  const updateEntity              = useWorldStore(s => s.updateEntity);
  const deleteEntity              = useWorldStore(s => s.deleteEntity);
  const renameEntityAcrossLibrary = useWorldStore(s => s.renameEntityAcrossLibrary);
  const fetchEntityContent        = useWorldStore(s => s.fetchEntityContent);
  const characters   = useWorldStore(s => s.characters);
  const locations    = useWorldStore(s => s.locations);
  const things       = useWorldStore(s => s.things);
  const lore         = useWorldStore(s => s.lore);
  const factions     = useWorldStore(s => s.factions);
  const creatures    = useWorldStore(s => s.creatures);
  const customEntities = useWorldStore(s => s.customEntities);
  const customTypes  = useWorldStore(s => s.customTypes);

  const allEntities = useMemo(() => [
    ...characters.map(e => ({ ...e, _type: 'characters' })),
    ...locations.map(e  => ({ ...e, _type: 'locations'  })),
    ...things.map(e     => ({ ...e, _type: 'things'     })),
    ...lore.filter(e => !e._isTimelineEvent).map(e => ({ ...e, _type: 'lore' })),
    ...factions.map(e   => ({ ...e, _type: 'factions'   })),
    ...creatures.map(e  => ({ ...e, _type: 'creatures'  })),
    ...customEntities.map(e => ({ ...e, _type: 'customEntities' })),
  ], [characters, locations, things, lore, factions, creatures, customEntities]);

  // Fallback for custom entities: use a basic template or construct one
  let template = getTemplate(entityType);
  if (!template && entityType === 'customEntities') {
    const typeDef = customTypes.find(t => t.id === params.typeId || t.id === pathSegments[1]);
    template = {
      id: 'custom',
      label: typeDef ? typeDef.singular : 'Custom Entity',
      color: 'blue',
      sections: [
        {
          title: 'Details',
          sidebar: true,
          fields: [
            { key: 'status', label: 'Status', type: 'text' },
          ]
        },
        {
          title: 'Overview',
          fields: [
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'notes', label: 'Notes', type: 'textarea' }
          ]
        }
      ]
    };
  }

  const allKeys  = template ? template.sections.flatMap(s => s.fields).map(f => f.key) : [];
  const entity   = entities.find(e => e.id === id);

  // Lazy content loading: fetch full content from disk on mount if not already loaded
  const [contentLoaded, setContentLoaded] = useState(false);
  useEffect(() => {
    if (!entity || !id || !entityType) return;
    // If entity already has content loaded (e.g. from a previous visit), skip
    const textareaKeys = allKeys.filter(k => {
      const field = template?.sections.flatMap(s => s.fields).find(f => f.key === k);
      return field?.type === 'textarea';
    });
    const hasContent = textareaKeys.some(k => entity[k] != null && entity[k] !== '');
    if (hasContent) {
      setContentLoaded(true);
      return;
    }
    // Fetch full content from disk
    fetchEntityContent(entityType, id).then((full) => {
      setContentLoaded(true);
    });
  }, [entityType, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [values, setValues] = useState(() => {
    if (!entity) return {};
    const v = {};
    allKeys.forEach(k => { v[k] = entity[k] ?? (k === 'tags' ? [] : ''); });
    if (entity.description) {
      const firstTextarea = template?.sections.flatMap(s => s.fields).find(f => f.type === 'textarea');
      if (firstTextarea && !v[firstTextarea.key]) v[firstTextarea.key] = entity.description;
    }
    // Extra fields stored on the entity but not defined in template
    if (entityType === 'characters') {
      v.inventory = Array.isArray(entity.inventory) ? entity.inventory : [];
    }
    if (entityType === 'factions') {
      v.notableMembers = Array.isArray(entity.notableMembers) ? entity.notableMembers : [];
      v.membership     = Array.isArray(entity.membership)     ? entity.membership     : [];
    }
    return v;
  });

  // When full content arrives from disk, merge it into the local values
  useEffect(() => {
    if (!contentLoaded || !entity) return;
    setValues(prev => {
      const next = { ...prev };
      allKeys.forEach(k => {
        if (entity[k] != null && (prev[k] === '' || prev[k] === undefined)) {
          next[k] = entity[k];
        }
      });
      return next;
    });
  }, [contentLoaded, entity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [mode, setMode]           = useState(location.state?.autoEdit ? 'edit' : 'view');
  const [mainTab, setMainTab]     = useState('lore');

  // Clear autoEdit from history state so it doesn't persist on back-navigation
  useEffect(() => {
    if (location.state?.autoEdit) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []); // eslint-disable-line
  const [saveState, setSaveState]  = useState('saved');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [favoriteOn, setFavoriteOn] = useState(() =>
    !!(activeWorld && id && isFavorite(activeWorld, entityType, id))
  );
  const autosaveTimer = useRef(null);
  const pendingRef    = useRef(null);
  // tracks the name that is currently persisted to disk so we can detect renames
  const committedNameRef = useRef(entity?.name || '');
  // Guard against setState after unmount (happens when navigating away mid-autosave)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => { committedNameRef.current = entity?.name || ''; }, [id]); // eslint-disable-line

  // ⌘E toggles edit mode
  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setMode(m => m === 'view' ? 'edit' : 'view');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const doSave = useCallback(async (vals) => {
    if (mountedRef.current) setSaveState('saving');
    const oldName = committedNameRef.current;
    const newName = vals.name || '';
    if (newName && newName !== oldName) {
      await renameEntityAcrossLibrary(entityType, id, oldName, newName, { ...vals, tags: vals.tags || [] });
      committedNameRef.current = newName;
    } else {
      await updateEntity(entityType, id, { ...vals, tags: vals.tags || [] });
    }
    pendingRef.current = null;
    if (mountedRef.current) setSaveState('saved');
  }, [entityType, id, updateEntity, renameEntityAcrossLibrary]);

  const scheduleAutosave = useCallback((vals) => {
    pendingRef.current = vals;
    setSaveState('unsaved');
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(vals), AUTOSAVE_DELAY);
  }, [doSave]);

  useEffect(() => () => {
    clearTimeout(autosaveTimer.current);
    // Flush any unsaved changes to disk without touching React state
    // (component may already be unmounting / unmounted)
    if (pendingRef.current) {
      const vals = pendingRef.current;
      const oldName = committedNameRef.current;
      const newName = vals.name || '';
      if (newName && newName !== oldName) {
        renameEntityAcrossLibrary(entityType, id, oldName, newName, { ...vals, tags: vals.tags || [] });
      } else {
        updateEntity(entityType, id, { ...vals, tags: vals.tags || [] });
      }
      pendingRef.current = null;
    }
  }, [entityType, id, updateEntity, renameEntityAcrossLibrary]);

  const set = (key, val) => {
    const next = { ...values, [key]: val };
    setValues(next);
    scheduleAutosave(next);
  };

  if (!entity || !template) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Entry not found.</div>;
  }

  const c = COLOR[template.color] || COLOR.blue;

  const visibleSections = getVisibleSections(entityType, values);

  const infoFields = visibleSections
    .flatMap(s => s.fields)
    .filter(f => f.type !== 'textarea' && f.type !== 'tags' && f.key !== 'name' && f.key !== 'alias' && f.key !== 'image' && (f.type === 'text' || f.type === 'select' || f.type === 'race-select' || f.type === 'faction-rank-select'));

  const CUSTOM_FIELD_TYPES = ['character-select', 'thing-select', 'membership-levels', 'subraces'];
  const SIDEBAR_SECTION_TITLES = entityType === 'characters' ? ['Skills & Abilities'] : [];
  const sidebarTemplateSections = visibleSections.filter(s => s.sidebar);
  const proseSections  = visibleSections.filter(s => !s.sidebar && s.fields.some(f => f.type === 'textarea') && !SIDEBAR_SECTION_TITLES.includes(s.title));
  const customSections = visibleSections.filter(s => !s.sidebar && s.fields.some(f => CUSTOM_FIELD_TYPES.includes(f.type)));
  const sidebarProseSections = visibleSections.filter(s => SIDEBAR_SECTION_TITLES.includes(s.title));

  const factionMemberCount = entityType === 'factions' ? new Set([
    ...(Array.isArray(values.notableMembers) ? values.notableMembers : []),
    ...(Array.isArray(values.membership) ? values.membership.flatMap(l => l.members || []) : []),
  ]).size : null;
  const isEdit         = mode === 'edit';

  const exportMarkdown = () => {
    const lines = [];
    lines.push(`# ${values.name || 'Untitled'}`);
    if (values.alias) lines.push(`*"${values.alias}"*`);
    lines.push('');
    lines.push(`**Type:** ${template.label}`);
    infoFields.forEach(f => { if (values[f.key]) lines.push(`**${f.label}:** ${values[f.key]}`); });
    if (Array.isArray(values.tags) && values.tags.length) lines.push(`**Tags:** ${values.tags.join(', ')}`);
    lines.push('');
    proseSections.forEach(section => {
      lines.push(`## ${section.title}`);
      section.fields.filter(f => f.type === 'textarea').forEach(f => {
        if (values[f.key]) { lines.push(`### ${f.label}`); lines.push(values[f.key]); lines.push(''); }
      });
    });
    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(values.name || 'entity').replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col bg-background">

      {/* ── Page header bar (sticky) ── */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 px-3 md:px-4 border-b border-border bg-background/95 backdrop-blur-md shrink-0 min-w-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => navigate(`/${entityType}`)}
          className="btn btn-ghost btn-icon sm:hidden"
          aria-label={`Back to ${template.label}s`}
        >
          <ArrowLeft />
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <button
            onClick={() => navigate(`/${entityType}`)}
            className="hidden sm:block shrink-0 rounded-md px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {template.label}s
          </button>
          <ChevronRight size={14} className="hidden sm:block shrink-0 text-muted-foreground/60" />
          <span className="truncate font-medium text-foreground">{values.name || entity.name}</span>
        </nav>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {/* Save state — only shown in edit mode */}
          {isEdit && saveState === 'saving'  && <span className="mr-1 text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving…</span>}
          {isEdit && saveState === 'unsaved' && <span className="mr-1 text-xs text-muted-foreground">Unsaved</span>}
          {isEdit && saveState === 'saved'   && <span className="mr-1 hidden sm:flex text-xs text-muted-foreground items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /> Saved</span>}

          {/* Edit / View toggle */}
          <div className="tabs mr-1" role="tablist" aria-label="Mode">
            <button role="tab" aria-selected={!isEdit} onClick={() => setMode('view')} className="tab inline-flex items-center gap-1.5">
              <Eye size={13} /> <span className="hidden sm:inline">View</span>
            </button>
            <button role="tab" aria-selected={isEdit} onClick={() => setMode('edit')} className="tab inline-flex items-center gap-1.5">
              <Edit3 size={13} /> <span className="hidden sm:inline">Edit</span>
            </button>
          </div>

          <button onClick={exportMarkdown} title="Export as Markdown" aria-label="Export as Markdown" className="btn btn-ghost btn-icon">
            <FileDown />
          </button>

          <button
            type="button"
            onClick={() => setFavoriteOn(toggleFavorite(activeWorld, entityType, id))}
            title={favoriteOn ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={favoriteOn ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favoriteOn}
            className={`btn btn-ghost btn-icon ${favoriteOn ? '!text-amber-500' : ''}`}
          >
            <Star className={favoriteOn ? 'fill-current' : ''} />
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete entry"
            aria-label="Delete entry"
            className="btn btn-ghost btn-icon hover:!text-destructive hover:!bg-destructive/10"
          >
            <Trash2 />
          </button>

          {isEdit && (
            <button onClick={() => doSave(values)} className="btn btn-outline ml-1">
              <Save /> Save
            </button>
          )}
        </div>
      </header>

      {/* ── Title area ── */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-5 sm:px-8 md:pt-12">
        <div className="flex gap-5 items-start">
          {values.image && (
            <div className="shrink-0 size-20 md:size-24 rounded-xl overflow-hidden border border-border">
              <img src={assetUrl(values.image)} alt={values.name} className="w-full h-full object-cover"
                onError={e => { e.target.parentElement.style.display = 'none'; }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap text-xs text-muted-foreground">
              <span className={`size-1.5 rounded-full ${c.dot} shrink-0`} />
              <span className="font-medium">{template.label}</span>
              {values.type && <><span aria-hidden>·</span><span>{values.type}</span></>}
              {values.status && <StatusBadge value={values.status} />}
              {!isEdit && <span className="ml-auto hidden sm:flex items-center gap-1">Press <kbd className="kbd">⌘E</kbd> to edit</span>}
            </div>

            {isEdit ? (
              <>
                <input
                  value={values.name || ''}
                  onChange={e => set('name', e.target.value)}
                  className="text-[1.75rem] md:text-[2rem] font-bold tracking-[-0.02em] text-foreground bg-transparent border-none focus:outline-none w-full placeholder:text-muted-foreground/40 leading-tight"
                  placeholder="Untitled"
                />
                {template.sections.flatMap(s => s.fields).some(f => f.key === 'alias') && (
                  <input
                    value={values.alias || ''}
                    onChange={e => set('alias', e.target.value)}
                    className="text-[0.9375rem] text-muted-foreground bg-transparent border-none focus:outline-none mt-1 w-full placeholder:text-muted-foreground/50"
                    placeholder="Alias or title…"
                  />
                )}
              </>
            ) : (
              <>
                <h1 className="text-[1.75rem] md:text-[2rem] font-bold tracking-[-0.02em] text-foreground leading-tight">
                  {values.name || <span className="text-muted-foreground/50">Untitled</span>}
                </h1>
                {values.alias && <p className="text-[0.9375rem] text-muted-foreground mt-1">{values.alias}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs for Characters/Creatures and Factions ── */}
      {((dndEnabled && (entityType === 'characters' || entityType === 'creatures')) || entityType === 'factions') && (
        <div className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 flex gap-5" role="tablist">
            {[
              { key: 'lore', label: 'Lore & Details' },
              entityType === 'factions'
                ? { key: 'orgchart', label: 'Org Chart' }
                : { key: 'statblock', label: 'D&D Stat Block' },
            ].map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={mainTab === t.key}
                onClick={() => setMainTab(t.key)}
                className={`-mb-px h-10 text-sm font-medium border-b-2 transition-colors ${mainTab === t.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

        {/* ── Two-column layout ── */}
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 pt-6 pb-12 flex flex-col lg:flex-row gap-8 lg:gap-12 min-h-0">

          {/* ── Main column ── */}
          <div className="flex-1 min-w-0 flex flex-col">

            {mainTab === 'statblock' && (
              <StatBlockEditor values={values} onChange={set} isEdit={isEdit} />
            )}

            {mainTab === 'orgchart' && (
              <OrgChart membership={values.membership || []} />
            )}

            {/* Prose content */}
            <div className={`space-y-10 ${mainTab !== 'lore' ? 'hidden' : ''}`}>
              {proseSections.map((section, idx) => {
                const textFields = section.fields.filter(f => f.type === 'textarea');
                const hasImageField = isEdit && section.fields.some(f => f.key === 'image');

                if (textFields.length === 0 && !hasImageField) return null;

                return (
                  <div key={idx} className="space-y-6">
                    <div className="sticky top-12 z-20 bg-background/95 backdrop-blur-md pt-3 pb-2 border-b border-border mb-3 -mt-3">
                      <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                        {section.title}
                      </h2>
                    </div>

                    <div className="space-y-5">
                      {textFields.map(f => isEdit ? (
                        <ProseEditor
                          key={f.key}
                          label={f.label}
                          value={values[f.key] || ''}
                          onChange={v => set(f.key, v)}
                          placeholder={f.placeholder}
                          minRows={f.rows || 4}
                        />
                      ) : (
                        <ProseViewer
                          key={f.key}
                          label={f.label}
                          value={values[f.key] || ''}
                          allEntities={allEntities}
                          navigate={navigate}
                          onEdit={() => setMode('edit')}
                        />
                      ))}

                      {hasImageField && (
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                            Portrait / Image URL
                          </label>
                          <div className="flex gap-2">
                            <input
                              value={values.image || ''}
                              onChange={e => set('image', e.target.value)}
                              placeholder="https://… or asset://…"
                              className="input flex-1 min-w-0"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await api.importAsset({ world: activeWorld });
                                  if (res.success && res.imported?.length) {
                                    set('image', `asset://${activeWorld}/assets/${res.imported[0]}`);
                                  }
                                } catch (err) { console.error(err); }
                              }}
                              className="btn btn-outline"
                            >
                              Browse
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Custom field sections (character-select, membership-levels) */}
              {customSections.map((section, idx) => (
                <div key={`custom-${idx}`} className="space-y-6">
                  <div className="sticky top-12 z-20 bg-background/95 backdrop-blur-md pt-3 pb-2 border-b border-border mb-3 -mt-3">
                    <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">{section.title}</h2>
                  </div>
                  <div className="space-y-6">
                    {section.fields.filter(f => CUSTOM_FIELD_TYPES.includes(f.type)).map(f => (
                      <div key={f.key} className="card overflow-hidden">
                        <div className="flex items-center justify-between px-4 h-10 border-b border-border">
                          <span className="text-[0.8125rem] font-semibold text-foreground">{f.label}</span>
                        </div>
                        <div className="px-4 py-4">
                          {f.type === 'character-select' && (
                            <CharacterSelectField
                              value={values[f.key] || []}
                              onChange={v => set(f.key, v)}
                              readOnly={!isEdit}
                            />
                          )}
                          {f.type === 'thing-select' && (
                            <ThingSelectField
                              value={values[f.key] || []}
                              onChange={v => set(f.key, v)}
                              readOnly={!isEdit}
                            />
                          )}
                          {f.type === 'membership-levels' && (
                            <MembershipLevelsEditor
                              value={values[f.key] || []}
                              onChange={v => set(f.key, v)}
                              readOnly={!isEdit}
                            />
                          )}
                          {f.type === 'subraces' && (
                            <SubracesEditor
                              value={values[f.key] || []}
                              onChange={v => set(f.key, v)}
                              readOnly={!isEdit}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="lg:w-80 lg:shrink-0 space-y-4 pt-6 lg:pt-0 border-t lg:border-t-0 border-border">

            {isEdit ? (
              /* Edit mode sidebar: all fields editable */
              <>
                {(infoFields.length > 0 || factionMemberCount !== null) && (
                  <div className="card">
                    <div className="px-4 h-10 flex items-center border-b border-border">
                      <p className="text-[0.8125rem] font-semibold text-foreground">Properties</p>
                    </div>
                    <div className="divide-y divide-border">
                      {factionMemberCount !== null && (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">Members</span>
                          <div className="flex items-center gap-1.5">
                            <Users size={13} className="text-muted-foreground" />
                            <span className="text-[0.8125rem] text-foreground font-medium">{factionMemberCount}</span>
                          </div>
                        </div>
                      )}
                      {infoFields.map(f => (
                        <div key={f.key} className="px-4 py-3">
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{f.label}</label>
                          <InfoFieldEditor field={f} value={values[f.key]} onChange={v => set(f.key, v)} values={values} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sidebarProseSections.map((section, idx) => (
                  <div key={idx} className="card">
                    <div className="px-4 h-10 flex items-center border-b border-border">
                      <p className="text-[0.8125rem] font-semibold text-foreground">{section.title}</p>
                    </div>
                    <div className="divide-y divide-border">
                      {section.fields.filter(f => f.type === 'textarea').map(f => (
                        <div key={f.key} className="px-4 py-3">
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{f.label}</label>
                          <TextareaAutosize
                            value={values[f.key] || ''}
                            onChange={e => set(f.key, e.target.value)}
                            placeholder={f.placeholder || '—'}
                            minRows={f.rows || 3}
                            className="input h-auto py-2 leading-relaxed resize-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Sidebar template sections (e.g. Notable Members for factions) */}
                {sidebarTemplateSections.map((section, idx) => (
                  <div key={`sts-edit-${idx}`} className="card overflow-hidden">
                    <div className="px-4 h-10 flex items-center border-b border-border">
                      <p className="text-[0.8125rem] font-semibold text-foreground">{section.title}</p>
                    </div>
                    <div className="px-4 py-3.5">
                      {section.fields.filter(f => f.type === 'character-select').map(f => (
                        <CharacterSelectField key={f.key} value={values[f.key] || []} onChange={v => set(f.key, v)} />
                      ))}
                      {section.fields.filter(f => f.type === 'thing-select').map(f => (
                        <ThingSelectField key={f.key} value={values[f.key] || []} onChange={v => set(f.key, v)} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* View mode sidebar: read-only */
              <>
                <InfoView infoFields={infoFields} values={values} memberCount={factionMemberCount} />

                {sidebarProseSections.map((section, idx) => {
                  const hasContent = section.fields.some(f => f.type === 'textarea' && values[f.key]);
                  if (!hasContent) return null;
                  return (
                    <div key={idx} className="card">
                      <div className="px-4 h-10 flex items-center border-b border-border">
                        <p className="text-[0.8125rem] font-semibold text-foreground">{section.title}</p>
                      </div>
                      <div className="divide-y divide-border">
                        {section.fields.filter(f => f.type === 'textarea' && values[f.key]).map(f => (
                          <div key={f.key} className="px-4 py-3">
                            <ProseViewer
                              label={f.label}
                              value={values[f.key]}
                              allEntities={allEntities}
                              navigate={navigate}
                              onEdit={() => setMode('edit')}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Sidebar template sections (e.g. Notable Members for factions) */}
                {sidebarTemplateSections.map((section, idx) => (
                  <div key={`sts-view-${idx}`} className="card overflow-hidden">
                    <div className="px-4 h-10 flex items-center border-b border-border">
                      <p className="text-[0.8125rem] font-semibold text-foreground">{section.title}</p>
                    </div>
                    <div className="px-4 py-3.5">
                      {section.fields.filter(f => f.type === 'character-select').map(f => (
                        <CharacterSelectField key={f.key} value={values[f.key] || []} onChange={() => {}} readOnly />
                      ))}
                      {section.fields.filter(f => f.type === 'thing-select').map(f => (
                        <ThingSelectField key={f.key} value={values[f.key] || []} onChange={() => {}} readOnly />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Always visible */}
            {entityType === 'characters' && (
              <InventoryPanel
                inventory={values.inventory || []}
                onChange={v => set('inventory', v)}
              />
            )}
            <RelationshipsPanel entityId={id} entityType={entityType} />
            <AppearsIn entityName={values.name || entity.name} />
            <Backlinks entityId={id} entityName={values.name || entity.name} entityType={entityType} />
            <MiniGraph entityId={id} entityType={entityType} entityName={values.name || entity.name} allEntities={allEntities} />
          </aside>
        </div>
      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${template.label}`}
          message={`Move "${values.name || entity.name}" to Trash? You can restore it later from Settings → Trash or the sidebar.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            clearTimeout(autosaveTimer.current);
            await deleteEntity(entityType, id);
            navigate(`/${entityType}`);
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

export default function EntityWiki() {
  const location = useLocation();
  const activeWorld = useWorldStore(s => s.activeWorld);
  return <EntityWikiContent key={`${activeWorld}:${location.pathname}`} />;
}
