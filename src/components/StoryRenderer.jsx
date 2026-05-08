import { useMemo, useState, useRef, useEffect } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { Users, Map as MapIcon, Box, BookMarked, Flag, PawPrint, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseSegments, TYPE_CHIP } from './richEditor';

const ENTITY_META = {
  characters: { icon: Users,      color: 'text-blue-400',   bg: 'bg-blue-500/10 hover:bg-blue-500/20',   border: 'border-blue-500/30',   dot: 'bg-blue-400'   },
  locations:  { icon: MapIcon,    color: 'text-green-400',  bg: 'bg-green-500/10 hover:bg-green-500/20',  border: 'border-green-500/30',  dot: 'bg-green-400'  },
  things:     { icon: Box,        color: 'text-amber-400',  bg: 'bg-amber-500/10 hover:bg-amber-500/20',  border: 'border-amber-500/30',  dot: 'bg-amber-400'  },
  lore:       { icon: BookMarked, color: 'text-purple-400', bg: 'bg-purple-500/10 hover:bg-purple-500/20', border: 'border-purple-500/30', dot: 'bg-purple-400' },
  factions:   { icon: Flag,       color: 'text-indigo-400', bg: 'bg-indigo-500/10 hover:bg-indigo-500/20', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
  creatures:  { icon: PawPrint,   color: 'text-orange-400', bg: 'bg-orange-500/10 hover:bg-orange-500/20', border: 'border-orange-500/30', dot: 'bg-orange-400' },
};

function EntityTooltip({ entity, entityType, anchorRef }) {
  const meta = ENTITY_META[entityType];
  const ref = useRef(null);
  const [style, setStyle] = useState({ opacity: 0, arrowOnTop: false });

  useEffect(() => {
    if (!anchorRef.current || !ref.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const t = ref.current.getBoundingClientRect();
    const above = a.top > t.height + 16;
    const left = Math.max(8, Math.min(a.left + a.width / 2 - t.width / 2, window.innerWidth - t.width - 8));
    setStyle({ position: 'fixed', top: above ? a.top - t.height - 8 : a.bottom + 8, left, opacity: 1, arrowOnTop: above });
  }, [anchorRef]);

  const preview = entity.appearance || entity.description || entity.background || entity.personality || entity.atmosphere || entity.origin || '';

  return (
    <div ref={ref} style={style} className="z-50 w-72 bg-popover border border-border rounded-xl shadow-2xl p-4 pointer-events-none transition-opacity">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{entityType.slice(0, -1)}</span>
          {entity.type && <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{entity.type}</span>}
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1 opacity-60"><ExternalLink size={10} /> click</span>
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{entity.name}</p>
      {entity.alias && <p className="text-xs text-muted-foreground italic mb-1">"{entity.alias}"</p>}
      {preview && <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{preview}</p>}
      <div className={`absolute left-[calc(50%-4px)] w-2 h-2 bg-popover rotate-45 border-border ${style.arrowOnTop ? 'bottom-[-5px] border-r border-b' : 'top-[-5px] border-l border-t'}`} />
    </div>
  );
}

function EntityChip({ entity, entityType, suffix = '' }) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  const anchorRef = useRef(null);
  const meta = ENTITY_META[entityType];
  const Icon = meta.icon;
  const chipClass = TYPE_CHIP[entityType] || '';

  return (
    <>
      <span ref={anchorRef} className="inline">
        <button
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={e => { e.stopPropagation(); navigate(`/${entityType}/${entity.id}`); }}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-sm font-medium transition-all cursor-pointer ${chipClass}`}
        >
          <Icon size={11} />{entity.name}
        </button>
        {suffix && <span className="text-inherit">{suffix}</span>}
      </span>
      {hovered && <EntityTooltip entity={entity} entityType={entityType} anchorRef={anchorRef} />}
    </>
  );
}

function parseParagraphs(text, entityByName) {
  if (!text) return [];
  const segments = parseSegments(text, entityByName);
  const result = [];
  let current = [];
  for (const seg of segments) {
    if (seg.type === 'text') {
      const lines = seg.value.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) { if (current.length) result.push(current); current = []; }
        if (line) current.push({ type: 'text', value: line });
      });
    } else {
      current.push(seg);
    }
  }
  if (current.length) result.push(current);
  return result;
}

function isSceneBreakPara(para) {
  if (!para || para.length !== 1 || para[0].type !== 'text') return false;
  const t = para[0].value.trim();
  return t === '* * *' || t === '***' || /^(\*\s*){3}$/.test(t);
}

export default function StoryRenderer({ content, pageMode, pageWidth = 550, pageHeight = 900, showChips = true }) {
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);

  const entityByName = useMemo(() => {
    const m = new Map();
    const add = (arr, type) => {
      for (const e of arr) {
        if (!e.name) continue;
        m.set(e.name.toLowerCase(), { entity: e, type });
      }
    };
    add(characters, 'characters');
    add(locations,  'locations');
    add(things,     'things');
    // Real lore only — timeline pseudo-rows aren't navigable wiki entries.
    add(lore.filter(e => !e._isTimelineEvent), 'lore');
    add(factions,   'factions');
    add(creatures,  'creatures');
    return m;
  }, [characters, locations, things, lore, factions, creatures]);

  const renderSeg = (seg, si) => {
    if (seg.type === 'entity') {
      if (showChips) return <EntityChip key={si} entity={seg.meta.entity} entityType={seg.meta.type} suffix={seg.suffix} />;
      return <span key={si}>{seg.meta.entity.name}{seg.suffix || ''}</span>;
    }
    return <span key={si}>{seg.value}</span>;
  };

  const renderPage = (paras, pageIdx, totalPages) => {
    const padH = 72;
    const padW = 60;
    return (
      <div key={pageIdx} className="book-page-dark relative" style={{ width: pageWidth, minHeight: pageHeight, padding: `${padH}px ${padW}px` }}>
        <div className="font-story prose-page" style={{ fontSize: '15px', lineHeight: '1.625', tabSize: 4, MozTabSize: 4, whiteSpace: 'pre-wrap' }}>
          {paras.map((para, pi) => (
            isSceneBreakPara(para) ? (
              <div key={pi} className="flex justify-center my-8 text-muted-foreground/50 tracking-[0.45em] text-sm select-none">* * *</div>
            ) : (
              <p key={pi}>{para.map(renderSeg)}</p>
            )
          ))}
        </div>
        <div
          className="absolute bottom-6 left-0 right-0 flex items-center justify-between pointer-events-none select-none"
          style={{ padding: `0 ${padW}px`, color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', letterSpacing: '0.08em' }}
        >
          <span />
          <span>{pageIdx + 1} / {totalPages}</span>
        </div>
      </div>
    );
  };

  const parsedPages = useMemo(() => {
    if (!content?.trim()) return [];
    if (pageMode) return content.split('\f').map(p => parseParagraphs(p, entityByName));
    return [parseParagraphs(content.replace(/\f/g, '\n\n'), entityByName)];
  }, [content, pageMode, entityByName]);

  if (pageMode) {
    if (!content?.trim()) {
      return (
        <div className="book-page-dark" style={{ width: pageWidth, minHeight: pageHeight, padding: '72px 60px' }}>
          <p className="font-story" style={{ fontSize: '15px', lineHeight: '1.625', color: 'rgba(255,255,255,0.2)' }}>
            Nothing written yet. Switch to Edit mode to start your story.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {parsedPages.map((paras, i) => renderPage(paras, i, parsedPages.length))}
      </div>
    );
  }

  // Loose (non-paged) mode
  if (!content?.trim()) {
    return <div className="w-full max-w-[550px] mx-auto text-muted-foreground/40 italic font-story" style={{ fontSize: '15px', lineHeight: '1.625' }}>Nothing written yet.</div>;
  }
  const paras = parsedPages[0] ?? [];
  return (
    <div className="w-full max-w-[550px] mx-auto font-story text-foreground prose-page" style={{ fontSize: '15px', lineHeight: '1.625', tabSize: 4, MozTabSize: 4, whiteSpace: 'pre-wrap' }}>
      {paras.map((para, pi) => (
        isSceneBreakPara(para) ? (
          <div key={pi} className="flex justify-center my-8 text-muted-foreground/40 tracking-[0.45em] text-sm select-none">* * *</div>
        ) : (
          <p key={pi}>{para.map(renderSeg)}</p>
        )
      ))}
    </div>
  );
}
