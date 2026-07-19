import TextareaAutosize from 'react-textarea-autosize';
import { useState } from 'react';
import { Plus, Trash2, X, Dice5 } from 'lucide-react';

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
        <div className="border-y-4 border-y-amber-600/40 bg-secondary/10 p-5 font-serif">
          <h2 className="text-2xl font-bold text-amber-600 dark:text-amber-500 mb-1">{values.name}</h2>
          <p className="italic text-muted-foreground text-sm border-b border-amber-600/20 pb-2 mb-2">
            {values.type || 'Medium humanoid'}, {values.status || 'unaligned'}
          </p>
          
          <div className="text-sm space-y-1 text-foreground/90 mb-4 border-b border-amber-600/20 pb-4">
            <p><strong>Armor Class</strong> {stats.ac || 10}</p>
            <p><strong>Hit Points</strong> {stats.hp || 10}</p>
            <p><strong>Speed</strong> {stats.speed || '30 ft.'}</p>
          </div>

          <div className="flex justify-between text-center border-b border-amber-600/20 pb-4 mb-4">
            {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
              <div key={stat}>
                <div className="font-bold text-sm text-foreground">{stat}</div>
                <div className="text-sm text-foreground/80">{stats[stat.toLowerCase()]} ({formatMod(calcMod(stats[stat.toLowerCase()]))})</div>
              </div>
            ))}
          </div>

          <div className="text-sm space-y-1 text-foreground/90 mb-4 border-b border-amber-600/20 pb-4">
            {stats.senses && <p><strong>Senses</strong> {stats.senses}</p>}
            {stats.languages && <p><strong>Languages</strong> {stats.languages}</p>}
            {stats.cr && <p><strong>Challenge</strong> {stats.cr}</p>}
          </div>

          {stats.actions && stats.actions.length > 0 && (
            <div>
              <h3 className="text-xl font-bold border-b border-amber-600/20 pb-1 mb-3 text-amber-600 dark:text-amber-500">Actions</h3>
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
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Armor Class</label>
          <input value={stats.ac} onChange={e => update({ ac: e.target.value })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Hit Points</label>
          <input value={stats.hp} onChange={e => update({ hp: e.target.value })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Speed</label>
          <input value={stats.speed} onChange={e => update({ speed: e.target.value })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="30 ft." />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
          <div key={stat}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 text-center">{stat}</label>
            <input type="number" value={stats[stat.toLowerCase()]} onChange={e => update({ [stat.toLowerCase()]: e.target.value })} className="w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Senses</label>
          <input value={stats.senses} onChange={e => update({ senses: e.target.value })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="darkvision 60 ft." />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Languages</label>
          <input value={stats.languages} onChange={e => update({ languages: e.target.value })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="Common" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Challenge Rating (CR)</label>
          <input value={stats.cr} onChange={e => update({ cr: e.target.value })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="1" />
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
          <span>Actions</span>
          <button onClick={addAction} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
            <Plus size={12} /> Add Action
          </button>
        </h3>
        <div className="flex flex-col gap-3">
          {(stats.actions || []).map((act, idx) => (
            <div key={idx} className="flex flex-col gap-2 p-3 border border-border rounded-lg bg-card">
              <div className="flex items-center justify-between gap-2">
                <input value={act.name} onChange={e => updateAction(idx, { name: e.target.value })} placeholder="Action Name" className="flex-1 bg-secondary border border-border rounded-md px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500" />
                <button onClick={() => removeAction(idx)} className="text-muted-foreground hover:text-red-400 p-1"><Trash2 size={14} /></button>
              </div>
              <TextareaAutosize value={act.desc} onChange={e => updateAction(idx, { desc: e.target.value })} placeholder="Description / Hit details" minRows={2} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y" />
            </div>
          ))}
          {(stats.actions || []).length === 0 && (
            <p className="text-sm text-muted-foreground/50 italic py-2">No actions added.</p>
          )}
        </div>
      </div>
    </div>
  );
}
