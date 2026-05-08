import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { Users, Map, Box, BookOpen, BookMarked, Clock, Link2, FileText, TrendingUp, Globe, Feather, Flame } from 'lucide-react';
import { getWritingStreak } from '../lib/writingStreak';

function wordGoalKey(world) {
  return world ? `wb_world_word_goal_${world}` : '';
}

const STAT_META = [
  { key: 'characters', label: 'Characters', icon: Users,      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   path: '/characters' },
  { key: 'locations',  label: 'Locations',  icon: Map,        color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  path: '/locations' },
  { key: 'things',     label: 'Things',     icon: Box,        color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  path: '/things' },
  { key: 'lore',       label: 'Lore',       icon: BookMarked, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', path: '/lore' },
  { key: 'stories',    label: 'Stories',    icon: BookOpen,   color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', path: '/stories' },
];

function wordCount(text) {
  if (!text) return 0;
  return text.replace(/\f/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function StatCard({ meta, count, navigate }) {
  const Icon = meta.icon;
  return (
    <button
      onClick={() => navigate(meta.path)}
      className={`rounded-xl border ${meta.border} bg-card text-left p-4 hover:bg-secondary/30 transition-all group flex items-center gap-3`}
    >
      <div className={`p-2.5 rounded-lg ${meta.bg} shrink-0`}>
        <Icon size={18} className={meta.color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{count}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta.label}</p>
      </div>
    </button>
  );
}

function RecentItem({ entity, type, navigate }) {
  const TYPE_META = {
    characters: { color: 'text-blue-400',   dot: 'bg-blue-400',   label: 'character' },
    locations:  { color: 'text-green-400',  dot: 'bg-green-400',  label: 'location' },
    things:     { color: 'text-amber-400',  dot: 'bg-amber-400',  label: 'thing' },
    lore:       { color: 'text-purple-400', dot: 'bg-purple-400', label: 'lore' },
    stories:    { color: 'text-violet-400', dot: 'bg-violet-400', label: 'story' },
  };
  const meta = TYPE_META[type];
  const path = type === 'stories' ? `/stories/${entity.id}` : `/${type}/${entity.id}`;
  const preview = entity.description || entity.background || entity.atmosphere || entity.content?.slice(0, 80) || '';
  const ago = entity.updatedAt ? (() => {
    // eslint-disable-next-line react-hooks/purity -- relative timestamps for dashboard list
    const diff = Date.now() - entity.updatedAt;
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  })() : null;

  return (
    <button
      onClick={() => navigate(path)}
      className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-secondary/40 transition-colors rounded-lg group"
    >
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{entity.name}</p>
        {preview && <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>}
      </div>
      <div className="shrink-0 text-right">
        <span className="text-xs text-muted-foreground/40">{meta.label}</span>
        {ago && <p className="text-xs text-muted-foreground/30 mt-0.5">{ago}</p>}
      </div>
    </button>
  );
}

export default function Dashboard() {
  const characters  = useWorldStore(s => s.characters);
  const locations   = useWorldStore(s => s.locations);
  const things      = useWorldStore(s => s.things);
  const lore        = useWorldStore(s => s.lore);
  const stories     = useWorldStore(s => s.stories);
  const relationships = useWorldStore(s => s.relationships);
  const activeWorld = useWorldStore(s => s.activeWorld);
  const isLoading   = useWorldStore(s => s.isLoading);
  const navigate    = useNavigate();

  const [wordGoalInput, setWordGoalInput] = useState('');
  /* eslint-disable react-hooks/set-state-in-effect -- reset local draft when switching worlds */
  useEffect(() => {
    if (!activeWorld) {
      setWordGoalInput('');
      return;
    }
    const raw = localStorage.getItem(wordGoalKey(activeWorld));
    setWordGoalInput(raw && raw !== '0' ? String(Number(raw) || '') : '');
  }, [activeWorld]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persistWordGoal = (raw) => {
    const n = parseInt(String(raw).replace(/\D/g, ''), 10);
    if (!activeWorld) return;
    if (!n || n < 1) {
      localStorage.removeItem(wordGoalKey(activeWorld));
      setWordGoalInput('');
      return;
    }
    localStorage.setItem(wordGoalKey(activeWorld), String(n));
    setWordGoalInput(String(n));
  };

  const wordGoalNum = Number.parseInt(wordGoalInput, 10);

  const recentItems = useMemo(() => {
    const all = [
      ...characters.map(e => ({ entity: e, type: 'characters' })),
      ...locations.map(e  => ({ entity: e, type: 'locations' })),
      ...things.map(e     => ({ entity: e, type: 'things' })),
      ...lore.map(e       => ({ entity: e, type: 'lore' })),
      ...stories.map(e    => ({ entity: e, type: 'stories' })),
    ];
    return all
      .filter(({ entity }) => entity.updatedAt)
      .sort((a, b) => (b.entity.updatedAt || 0) - (a.entity.updatedAt || 0))
      .slice(0, 10);
  }, [characters, locations, things, lore, stories]);

  const totalWords = useMemo(
    () => stories.reduce((sum, s) => sum + wordCount(s.content), 0),
    [stories]
  );

  const goalProgress =
    Number.isFinite(wordGoalNum) && wordGoalNum > 0
      ? Math.min(100, Math.round((totalWords / wordGoalNum) * 100))
      : null;
  const streakDays = getWritingStreak(activeWorld);

  const totalEntities = characters.length + locations.length + things.length + lore.length;
  const counts = {
    characters: characters.length,
    locations:  locations.length,
    things:     things.length,
    lore:       lore.length,
    stories:    stories.length,
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading universe…</div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* World header */}
      <header className="flex items-center gap-2.5 px-6 py-5 border-b border-border bg-card mb-6">
        <Globe size={20} className="text-primary shrink-0" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{activeWorld}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalEntities === 0 ? 'Your universe awaits — start building.' : `${totalEntities} world entr${totalEntities === 1 ? 'y' : 'ies'} · ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'} · ${totalWords.toLocaleString()} words`}
          </p>
        </div>
      </header>
      <div className="px-4 pb-6 md:px-8">

      {/* Entity stat cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6">
        {STAT_META.map(meta => (
          <StatCard key={meta.key} meta={meta} count={counts[meta.key]} navigate={navigate} />
        ))}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <FileText size={16} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground leading-none">{totalWords.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total words</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <Link2 size={16} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground leading-none">{relationships.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Connections</p>
          </div>
        </div>
        <div
          onClick={() => navigate('/timeline')}
          className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        >
          <TrendingUp size={16} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground leading-none">{lore.filter(e => e._isTimelineEvent).length || '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Timeline events</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-start gap-3">
          <Flame size={16} className="text-orange-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-foreground leading-none">{streakDays > 0 ? streakDays : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {streakDays > 0
                ? `${streakDays}-day streak`
                : 'Writing streak · save a chapter today'}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-2 sm:col-span-2 lg:col-span-1 min-h-[76px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Story word goal</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 50000"
            value={wordGoalInput}
            onChange={e => setWordGoalInput(e.target.value)}
            onBlur={() => persistWordGoal(wordGoalInput)}
            className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {goalProgress !== null && (
            <p className="text-[11px] text-muted-foreground">
              {goalProgress}% · {totalWords.toLocaleString()} / {wordGoalNum.toLocaleString()} words
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recently Updated */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Recently Updated</h3>
          </div>
          {recentItems.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 italic px-3 py-4 text-center">Nothing yet — start creating!</p>
          ) : (
            <div className="space-y-0.5">
              {recentItems.map(({ entity, type }) => (
                <RecentItem key={`${type}-${entity.id}`} entity={entity} type={type} navigate={navigate} />
              ))}
            </div>
          )}
        </div>

        {/* Continue Writing + Quick Access */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Quick Access</h3>

          {/* Continue Writing shortcut */}
          {(() => {
            const lastStory = [...stories]
              .filter(s => s.updatedAt)
              .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
            if (!lastStory) return null;
            return (
              <button
                onClick={() => navigate(`/stories/${lastStory.id}`)}
                className="w-full flex items-center gap-3 mb-3 px-4 py-3 rounded-xl border border-violet-500/30 bg-violet-500/8 hover:bg-violet-500/15 transition-all group text-left"
              >
                <div className="p-2 rounded-lg bg-violet-500/20 shrink-0">
                  <Feather size={15} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-0.5">Continue Writing</p>
                  <p className="text-sm font-medium text-foreground truncate">{lastStory.name}</p>
                </div>
                <span className="text-xs text-muted-foreground/50 shrink-0">{wordCount(lastStory.content || '').toLocaleString()}w</span>
              </button>
            );
          })()}

          <div className="grid grid-cols-3 gap-2">
            {[
              { path: '/characters', icon: Users,      label: 'Characters', color: 'text-blue-400' },
              { path: '/locations',  icon: Map,        label: 'Locations',  color: 'text-green-400' },
              { path: '/things',     icon: Box,        label: 'Things',     color: 'text-amber-400' },
              { path: '/lore',       icon: BookMarked, label: 'Lore',       color: 'text-purple-400' },
              { path: '/stories',    icon: BookOpen,   label: 'Library',    color: 'text-violet-400' },
              { path: '/timeline',   icon: TrendingUp, label: 'Timeline',   color: 'text-rose-400' },
            ].map(({ path, icon: Icon, label, color }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/40 hover:bg-secondary transition-colors border border-border group"
              >
                <Icon size={18} className={color} />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
