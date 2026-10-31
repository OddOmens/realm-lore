import TextareaAutosize from 'react-textarea-autosize';
import { Plus, Trash2 } from 'lucide-react';

export default function StatBlockEditor({ values, onChange, isEdit }) {
  // If no stats object exists, initialize it
  const stats = values.dndStats || {
    ac: '',
    hp: '',
    speed: '',
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    senses: '',
    languages: '',
    cr: '',
    actions: []
  };

  const update = (patch) => {
    onChange('dndStats', { ...stats, ...patch });
    // Also auto-sync high level hp and ac if they are edited so InitiativeTracker sees them
    if (patch.hp !== undefined) onChange('hp', patch.hp);
    if (patch.ac !== undefined) onChange('ac', patch.ac);
  };

  const updateAction = (idx, patch) => {
    const newActions = [...(stats.actions || [])];
    newActions[idx] = { ...newActions[idx], ...patch };
    update({ actions: newActions });
  };

  const removeAction = (idx) => {
    update({ actions: (stats.actions || []).filter((_, i) => i !== idx) });
  };

  const addAction = () => {
    update({ actions: [...(stats.actions || []), { name: '', desc: '' }] });
  };

  const calcMod = (score) => Math.floor((parseInt(score) - 10) / 2);
  const formatMod = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;

  if (!isEdit) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-3xl">
        <div className="card border-t-2 border-t-amber-500/60 p-5">
          <h2 className="text-xl font-bold tracking-[-0.01em] text-foreground mb-0.5">{values.name}</h2>
          <p className="italic text-muted-foreground text-sm border-b border-border pb-3 mb-3">
            {values.type || 'Medium humanoid'}, {values.status || 'unaligned'}
          </p>
          
          <div className="text-sm space-y-1 text-foreground/90 mb-4 border-b border-border pb-4">
            <p><strong>Armor Class</strong> {stats.ac || 10}</p>
            <p><strong>Hit Points</strong> {stats.hp || 10}</p>
            <p><strong>Speed</strong> {stats.speed || '30 ft.'}</p>
          </div>

          <div className="grid grid-cols-6 gap-2 text-center border-b border-border pb-4 mb-4">
            {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
              <div key={stat}>
                <div className="section-label">{stat}</div>
                <div className="text-sm text-foreground tabular-nums">{stats[stat.toLowerCase()]} ({formatMod(calcMod(stats[stat.toLowerCase()]))})</div>
              </div>
            ))}
          </div>

          <div className="text-sm space-y-1 text-foreground/90 mb-4 border-b border-border pb-4">
            {stats.senses && <p><strong>Senses</strong> {stats.senses}</p>}
            {stats.languages && <p><strong>Languages</strong> {stats.languages}</p>}
            {stats.cr && <p><strong>Challenge</strong> {stats.cr}</p>}
          </div>

          {stats.actions && stats.actions.length > 0 && (
            <div>
              <h3 className="section-title border-b border-border pb-2 mb-3">Actions</h3>
              <div className="space-y-3">
                {stats.actions.map((act, idx) => (
                  <p key={idx} className="text-sm text-foreground/90 leading-relaxed">
                    <strong className="italic">{act.name}.</strong> {act.desc}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block section-label mb-1.5">Armor Class</label>
          <input value={stats.ac} onChange={e => update({ ac: e.target.value })} className="input w-full" />
        </div>
        <div>
          <label className="block section-label mb-1.5">Hit Points</label>
          <input value={stats.hp} onChange={e => update({ hp: e.target.value })} className="input w-full" />
        </div>
        <div className="col-span-2">
          <label className="block section-label mb-1.5">Speed</label>
          <input value={stats.speed} onChange={e => update({ speed: e.target.value })} className="input w-full" placeholder="30 ft." />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
          <div key={stat}>
            <label className="block section-label mb-1.5 text-center">{stat}</label>
            <input type="number" value={stats[stat.toLowerCase()]} onChange={e => update({ [stat.toLowerCase()]: e.target.value })} className="input w-full text-center" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block section-label mb-1.5">Senses</label>
          <input value={stats.senses} onChange={e => update({ senses: e.target.value })} className="input w-full" placeholder="darkvision 60 ft." />
        </div>
        <div>
          <label className="block section-label mb-1.5">Languages</label>
          <input value={stats.languages} onChange={e => update({ languages: e.target.value })} className="input w-full" placeholder="Common" />
        </div>
        <div className="col-span-2">
          <label className="block section-label mb-1.5">Challenge Rating (CR)</label>
          <input value={stats.cr} onChange={e => update({ cr: e.target.value })} className="input w-full" placeholder="1" />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">Actions</h3>
          <button onClick={addAction} className="btn btn-ghost btn-sm">
            <Plus /> Add action
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {(stats.actions || []).map((act, idx) => (
            <div key={idx} className="card flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <input value={act.name} onChange={e => updateAction(idx, { name: e.target.value })} placeholder="Action name" className="input flex-1" />
                <button onClick={() => removeAction(idx)} aria-label="Remove action" className="btn btn-ghost btn-icon hover:text-destructive"><Trash2 /></button>
              </div>
              <TextareaAutosize value={act.desc} onChange={e => updateAction(idx, { desc: e.target.value })} placeholder="Description / Hit details" minRows={2} className="input w-full resize-y" />
            </div>
          ))}
          {(stats.actions || []).length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No actions added.</p>
          )}
        </div>
      </div>
    </div>
  );
}
