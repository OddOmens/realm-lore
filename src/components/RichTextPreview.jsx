import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { parseSegments, TYPE_CHIP } from './richEditor';

export default function RichTextPreview({ text, className }) {
  const navigate   = useNavigate();
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);

  const entityByName = useMemo(() => {
    const m = new Map();
    const add = (arr, type) => { for (const e of arr) m.set(e.name.toLowerCase(), { entity: e, type }); };
    add(characters, 'characters');
    add(locations,  'locations');
    add(things,     'things');
    add(lore,       'lore');
    add(factions || [], 'factions');
    return m;
  }, [characters, locations, things, lore, factions]);

  const segments = useMemo(() => {
    if (!text) return [];
    return parseSegments(text, entityByName);
  }, [text, entityByName]);

  if (!text) return null;

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'entity') {
          const chipClass = TYPE_CHIP[seg.meta.type] || '';
          return (
            <span key={i} className="inline-block">
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/${seg.meta.type}/${seg.meta.entity.id}`); }}
                className={`inline-flex items-center px-1 py-0 rounded border text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${chipClass}`}
              >{seg.name}</button>
              {seg.suffix && <span>{seg.suffix}</span>}
            </span>
          );
        }
        // Strip newlines for card preview — just show inline text
        return <span key={i}>{seg.value.replace(/\n/g, ' ')}</span>;
      })}
    </span>
  );
}
