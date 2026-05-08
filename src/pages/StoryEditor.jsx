import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { ArrowLeft, Save, Eye, Edit3, CheckCircle2, Loader2, Target, Timer, StickyNote, Maximize2, Minimize2, CheckSquare, SlidersHorizontal, Tag, Rows3, Replace } from 'lucide-react';
import StoryRenderer from '../components/StoryRenderer';
import PagedEditor from '../components/PagedEditor';
import Modal from '../components/Modal';
import { recordWritingDay } from '../lib/writingStreak';

const STATUS_CYCLE = ['Draft', 'In Progress', 'Complete'];
const STATUS_STYLES = {
  Draft:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Complete:      'bg-green-500/10 text-green-400 border-green-500/30',
};

function useSessionTimer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  return { time: fmt(secs) };
}

const AUTOSAVE_DELAY = 1000;
function wordCount(text) {
  if (!text) return 0;
  // Strip page separators before counting
  return text.replace(/\f/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function WordGoalBar({ count, goal, onSetGoal }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(goal || ''));
  const pct = goal ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const done = goal && count >= goal;

  const save = () => {
    const n = parseInt(input, 10);
    onSetGoal(isNaN(n) || n <= 0 ? null : n);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      {goal ? (
        <button
          onClick={() => { setInput(String(goal)); setEditing(true); }}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${done ? 'text-green-400' : 'text-muted-foreground hover:text-foreground'}`}
          title="Click to change goal"
        >
          <Target size={11} />
          <span>{count.toLocaleString()} / {goal.toLocaleString()}</span>
          <span className="opacity-60">({pct}%)</span>
          {done && <CheckCircle2 size={11} />}
        </button>
      ) : (
        <button
          onClick={() => { setInput(''); setEditing(true); }}
          className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <Target size={11} /> Set goal
        </button>
      )}
      {goal && (
        <div className="hidden sm:flex w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${done ? 'bg-green-400' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditing(false)}>
          <div className="bg-card border border-border rounded-xl p-4 shadow-2xl w-64" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-foreground mb-3">Word count goal</p>
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="e.g. 5000"
              className="w-full bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring mb-3"
            />
            <div className="flex gap-2">
              {goal && <button onClick={() => { onSetGoal(null); setEditing(false); }} className="flex-1 text-sm py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">Remove</button>}
              <button onClick={save} className="flex-1 text-sm py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors">Set</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FindReplaceModal({ initialContent, onApplyAll, onClose }) {
  const [find, setFind] = useState('');
  const [repl, setRepl] = useState('');
  const [caseSens, setCaseSens] = useState(false);

  const applyAll = () => {
    if (!find) return;
    const next = caseSens
      ? initialContent.split(find).join(repl)
      : initialContent.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), repl);
    onApplyAll(next);
    onClose();
  };

  return (
    <Modal title="Find & replace" onClose={onClose} size="sm">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Find</label>
          <input
            autoFocus
            value={find}
            onChange={e => setFind(e.target.value)}
            className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Replace with</label>
          <input
            value={repl}
            onChange={e => setRepl(e.target.value)}
            className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={caseSens} onChange={e => setCaseSens(e.target.checked)} />
          Case sensitive (whole substring only)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-secondary">Cancel</button>
          <button type="button" onClick={applyAll} disabled={!find} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">
            Replace all
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function StoryEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const stories = useWorldStore(state => state.stories);
  const books = useWorldStore(state => state.books);
  const activeWorld = useWorldStore(state => state.activeWorld);
  const updateEntity = useWorldStore(state => state.updateEntity);

  const story = stories.find(s => s.id === id);
  const parentBook = story?.bookId ? books.find(b => b.id === story.bookId) : null;

  const editorRef = useRef(null);
  const prevSaveRef = useRef('');
  const [content, setContent] = useState(story?.content || '');
  const [title, setTitle] = useState(story?.name || '');
  const [mode, setMode] = useState('edit');
  const [saveState, setSaveState] = useState('saved');
  const [wordGoal, setWordGoalState] = useState(story?.wordGoal ?? null);
  const [status, setStatus] = useState(story?.status || 'Draft');
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(story?.notes || '');
  const [focusMode, setFocusMode] = useState(false);
  const [showDimSliders, setShowDimSliders] = useState(false);
  const [pageWidth, setPageWidth] = useState(550);
  const [pageHeight, setPageHeight] = useState(900);
  const [showChips, setShowChips] = useState(true);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const { time: sessionTime } = useSessionTimer();
  const [sessionBaselineWords, setSessionBaselineWords] = useState(null);

  const latestRef = useRef({ title, content, dirty: false });
  const autosaveTimer = useRef(null);
  const notesTimer = useRef(null);

  /* eslint-disable react-hooks/set-state-in-effect -- sync controlled fields when opening a different chapter */
  useEffect(() => {
    if (story) {
      setContent(story.content || '');
      setTitle(story.name || '');
      setWordGoalState(story.wordGoal ?? null);
      setStatus(story.status || 'Draft');
      setNotes(story.notes || '');
      latestRef.current = { title: story.name || '', content: story.content || '', dirty: false };
      setSessionBaselineWords(wordCount(story.content || ''));
    }
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const doSave = useCallback(async (t, c) => {
    try {
      setSaveState('saving');
      await updateEntity('stories', id, { name: t, content: c });
      latestRef.current.dirty = false;
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [id, updateEntity]);

  useEffect(() => {
    if (prevSaveRef.current === 'saving' && saveState === 'saved') {
      window.dispatchEvent(new CustomEvent('wb-save-flash', { detail: { label: 'Chapter saved' } }));
      recordWritingDay(activeWorld);
    }
    prevSaveRef.current = saveState;
  }, [saveState, activeWorld]);

  const scheduleAutosave = useCallback((t, c) => {
    latestRef.current = { title: t, content: c, dirty: true };
    setSaveState('unsaved');
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(t, c), AUTOSAVE_DELAY);
  }, [doSave]);

  useEffect(() => {
    return () => {
      clearTimeout(autosaveTimer.current);
      clearTimeout(notesTimer.current);
      const { title: t, content: c, dirty } = latestRef.current;
      if (dirty) updateEntity('stories', id, { name: t, content: c });
    };
  }, [id, updateEntity]);

  const handleSetWordGoal = useCallback(async (goal) => {
    setWordGoalState(goal);
    await updateEntity('stories', id, { wordGoal: goal ?? null });
  }, [id, updateEntity]);

  const cycleStatus = useCallback(async () => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
    setStatus(next);
    await updateEntity('stories', id, { status: next });
  }, [id, status, updateEntity]);

  const saveNotes = useCallback((val) => {
    setNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => updateEntity('stories', id, { notes: val }), 1000);
  }, [id, updateEntity]);

  const sessionWordsWritten =
    sessionBaselineWords != null ? Math.max(0, wordCount(content) - sessionBaselineWords) : 0;

  if (!story) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">Story not found.</div>
  );

  const backPath = parentBook ? `/books/${parentBook.id}` : '/stories';
  const wc = wordCount(content);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden bg-background transition-all ${focusMode ? 'fixed inset-0 z-50' : ''}`}>

      {/* ── Header ── */}
      <header className={`flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0 transition-all ${focusMode ? 'opacity-0 hover:opacity-100 absolute top-0 left-0 right-0 z-10' : ''}`}>
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium shrink-0"
          onClick={() => navigate(backPath)}
        >
          <ArrowLeft size={15} />
          <span className="hidden sm:inline">{parentBook ? parentBook.name : 'Library'}</span>
        </button>

        {parentBook && story.chapterNumber != null && (
          <span className="text-xs text-muted-foreground/60 shrink-0 hidden sm:block">Ch. {story.chapterNumber}</span>
        )}

        <div className="w-px h-4 bg-border shrink-0" />

        <input
          className="flex-1 min-w-0 bg-transparent border-none text-base font-semibold focus:outline-none text-foreground placeholder:text-muted-foreground/40"
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleAutosave(e.target.value, content); }}
          placeholder="Chapter Title"
        />

        <div className="flex items-center gap-2 shrink-0">
          <WordGoalBar count={wc} goal={wordGoal} onSetGoal={handleSetWordGoal} />

          {/* Session timer */}
          <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground/60 font-mono">
            <Timer size={10} />{sessionTime}
            {sessionWordsWritten > 0 && <span className="text-green-400/70">+{sessionWordsWritten}</span>}
          </div>

          {/* Status badge */}
          <button
            onClick={cycleStatus}
            title="Click to cycle status"
            className={`hidden sm:flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${STATUS_STYLES[status]}`}
          >
            <CheckSquare size={10} /> {status}
          </button>

          {/* Notes toggle */}
          <button
            onClick={() => setShowNotes(n => !n)}
            title="Chapter notes"
            className={`p-1.5 rounded-lg transition-colors ${showNotes ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
          >
            <StickyNote size={14} />
          </button>

          {/* Chip toggle — preview only */}
          {mode === 'preview' && (
            <button
              onClick={() => setShowChips(s => !s)}
              title={showChips ? 'Hide entity chips' : 'Show entity chips'}
              className={`p-1.5 rounded-lg transition-colors ${showChips ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            >
              <Tag size={14} />
            </button>
          )}

          {/* Page size sliders */}
          <button
            onClick={() => setShowDimSliders(s => !s)}
            title="Adjust page size"
            className={`p-1.5 rounded-lg transition-colors ${showDimSliders ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
          >
            <SlidersHorizontal size={14} />
          </button>

          {/* Scene break */}
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => editorRef.current?.insertSceneBreak?.()}
              title="Insert scene break (* * *)"
              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs font-medium"
            >
              <Rows3 size={13} /> Scene
            </button>
          )}

          {/* Find & replace */}
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => setShowFindReplace(true)}
              title="Find & replace in this chapter"
              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs font-medium"
            >
              <Replace size={13} /> Replace
            </button>
          )}

          {/* Focus mode */}
          <button
            onClick={() => setFocusMode(f => !f)}
            title={focusMode ? 'Exit focus mode' : 'Focus mode'}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            {saveState === 'saving'  && <><Loader2 size={11} className="animate-spin" /> Saving…</>}
            {saveState === 'unsaved' && <span>Unsaved</span>}
            {saveState === 'saved'   && <><CheckCircle2 size={11} className="text-green-400" /> Saved</>}
            {saveState === 'error'   && <span className="text-red-400">Save failed</span>}
          </div>

          {/* Edit / Preview toggle */}
          <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5 gap-0.5">
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'edit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Eye size={12} /> Preview
            </button>
          </div>

          <button
            onClick={() => doSave(title, content)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
          >
            <Save size={13} /><span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </header>

      {/* ── Body: canvas + notes ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Page canvas */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 px-4 py-10 relative">

          {/* Dimension sliders panel */}
          {showDimSliders && (
            <div className="absolute top-4 right-4 z-20 bg-card border border-border rounded-xl p-4 shadow-xl w-64 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page Size</p>

              {/* Presets */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Presets</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '5×8', w: 550, h: 900 },
                    { label: '6×9', w: 640, h: 960 },
                    { label: 'A5',  w: 560, h: 794 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => { setPageWidth(p.w); setPageHeight(p.h); }}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${pageWidth === p.w && pageHeight === p.h ? 'bg-primary/20 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Width</span><span className="font-mono text-foreground">{pageWidth}px</span>
                </div>
                <input type="range" min={320} max={720} step={4} value={pageWidth}
                  onChange={e => setPageWidth(Number(e.target.value))}
                  className="w-full accent-primary" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Height</span><span className="font-mono text-foreground">{pageHeight}px</span>
                </div>
                <input type="range" min={400} max={1200} step={4} value={pageHeight}
                  onChange={e => setPageHeight(Number(e.target.value))}
                  className="w-full accent-primary" />
              </div>
            </div>
          )}

          <div style={{ maxWidth: pageWidth, margin: '0 auto' }}>
            {mode === 'edit' ? (
              <PagedEditor
                ref={editorRef}
                value={content}
                onChange={val => { setContent(val); scheduleAutosave(title, val); }}
                placeholder="Begin your story here… type @ to link an entity"
                parentBook={parentBook}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
              />
            ) : (
              <StoryRenderer content={content} pageMode pageWidth={pageWidth} pageHeight={pageHeight} showChips={showChips} />
            )}
          </div>
        </main>

        {/* Chapter notes panel */}
        {showNotes && (
          <aside className="w-72 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <StickyNote size={13} className="text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Chapter Notes</span>
              </div>
              <button onClick={() => setShowNotes(false)} className="text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
            </div>
            <textarea
              value={notes}
              onChange={e => saveNotes(e.target.value)}
              placeholder="Jot down ideas, reminders, outline points for this chapter…"
              className="flex-1 bg-transparent text-sm text-foreground resize-none focus:outline-none px-4 py-3 leading-relaxed placeholder:text-muted-foreground/30"
            />
            <div className="px-4 py-2 border-t border-border">
              <p className="text-xs text-muted-foreground/40 italic">Notes are private — not exported with story text</p>
            </div>
          </aside>
        )}
      </div>

      {showFindReplace && (
        <FindReplaceModal
          initialContent={content}
          onApplyAll={(next) => {
            setContent(next);
            scheduleAutosave(title, next);
          }}
          onClose={() => setShowFindReplace(false)}
        />
      )}
    </div>
  );
}
