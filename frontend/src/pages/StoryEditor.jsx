import TextareaAutosize from 'react-textarea-autosize';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { ArrowLeft, Save, Eye, Edit3, CheckCircle2, Loader2, Target, Timer, StickyNote, Maximize2, Minimize2, SlidersHorizontal, Tag, Rows3, Replace, X, ChevronRight } from 'lucide-react';
import StoryRenderer from '../components/StoryRenderer';
import PagedEditor from '../components/PagedEditor';
import Modal from '../components/Modal';
import { recordWritingDay } from '../lib/writingStreak';

const STATUS_CYCLE = ['Draft', 'In Progress', 'Complete'];
const STATUS_DOTS = {
  Draft:         'bg-yellow-500',
  'In Progress': 'bg-blue-500',
  Complete:      'bg-green-500',
};

// Header icon buttons: ghost, with a quiet pressed state when their panel is open.
const iconBtn = (on) => `btn btn-ghost btn-icon ${on ? 'bg-accent text-foreground' : ''}`;

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
          className={`flex items-center gap-1.5 text-xs font-medium tabular-nums transition-colors ${done ? 'text-green-400' : 'text-muted-foreground hover:text-foreground'}`}
          title="Click to change goal"
        >
          <Target size={12} />
          <span className="hidden sm:inline">{count.toLocaleString()} / {goal.toLocaleString()}</span>
          <span className="sm:opacity-60"><span className="hidden sm:inline">(</span>{pct}%<span className="hidden sm:inline">)</span></span>
          {done && <CheckCircle2 size={11} />}
        </button>
      ) : (
        <button
          onClick={() => { setInput(''); setEditing(true); }}
          title="Set a word goal"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Target size={12} /> <span className="hidden sm:inline">Set goal</span>
        </button>
      )}
      {goal && (
        <div className="hidden sm:flex w-16 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-brand'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-backdrop-in" onClick={() => setEditing(false)}>
          <div role="dialog" aria-modal="true" className="bg-popover text-popover-foreground sm:ring-1 sm:ring-foreground/10 rounded-t-[14px] sm:rounded-xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-lg w-full sm:w-72 animate-sheet" onClick={e => e.stopPropagation()}>
            <p className="text-base font-semibold tracking-[-0.01em] text-foreground mb-3">Word count goal</p>
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="e.g. 5000"
              className="input mb-4"
            />
            <div className="flex justify-end gap-2">
              {goal && <button onClick={() => { onSetGoal(null); setEditing(false); }} className="btn btn-outline">Remove</button>}
              <button onClick={save} className="btn btn-primary">Set goal</button>
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
          <label className="block text-sm font-medium text-foreground mb-1.5">Find</label>
          <input
            autoFocus
            value={find}
            onChange={e => setFind(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Replace with</label>
          <input
            value={repl}
            onChange={e => setRepl(e.target.value)}
            className="input"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" className="accent-brand" checked={caseSens} onChange={e => setCaseSens(e.target.checked)} />
          Case sensitive (whole substring only)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="button" onClick={applyAll} disabled={!find} className="btn btn-primary">
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
  const fetchEntityContent = useWorldStore(state => state.fetchEntityContent);

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
  const isStoryLoaded = story && story.content !== undefined;

  const latestRef = useRef({ title, content, dirty: false });
  const autosaveTimer = useRef(null);
  const notesTimer = useRef(null);

  // Load the full story content from disk on mount / ID change
  useEffect(() => {
    if (id && story && story.content === undefined) {
      fetchEntityContent('stories', id);
    }
  }, [id, story, fetchEntityContent]);

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
  }, [story?.id, story?.content, story?.notes, story?.name]); // eslint-disable-line react-hooks/exhaustive-deps
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

  if (!isStoryLoaded) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background">
      <Loader2 className="animate-spin" size={20} />
      <p className="text-sm">Loading chapter…</p>
    </div>
  );

  const backPath = parentBook ? `/books/${parentBook.id}` : '/stories';
  const wc = wordCount(content);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden bg-background transition-all ${focusMode ? 'fixed inset-0 z-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]' : ''}`}>

      {/* ── Header ── */}
      <header className={`flex h-12 items-center gap-1.5 px-2 sm:px-3 border-b border-border bg-background shrink-0 transition-all ${focusMode ? 'opacity-0 hover:opacity-100 absolute top-[env(safe-area-inset-top)] left-0 right-0 z-10' : ''}`}>
        <button
          className="btn btn-ghost px-2 max-w-[14rem]"
          onClick={() => navigate(backPath)}
          title={`Back to ${parentBook ? parentBook.name : 'Library'}`}
        >
          <ArrowLeft />
          <span className="hidden sm:inline truncate">{parentBook ? parentBook.name : 'Library'}</span>
        </button>

        <ChevronRight size={14} className="hidden sm:block shrink-0 text-muted-foreground/50" />

        {parentBook && story.chapterNumber != null && (
          <span className="text-sm text-muted-foreground shrink-0 hidden sm:block">Ch. {story.chapterNumber}</span>
        )}

        <input
          className="flex-1 min-w-[5rem] h-8 rounded-md bg-transparent px-1.5 text-[0.9375rem] font-semibold text-foreground placeholder:text-muted-foreground/50 hover:bg-accent/50 focus:bg-accent/50 focus:outline-none transition-colors"
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleAutosave(e.target.value, content); }}
          placeholder="Chapter title"
        />

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <div className="mr-1 sm:mr-1.5">
            <WordGoalBar count={wc} goal={wordGoal} onSetGoal={handleSetWordGoal} />
          </div>

          {/* Session timer */}
          <div className="hidden md:flex items-center gap-1 mr-1.5 text-xs text-muted-foreground tabular-nums">
            <Timer size={12} />{sessionTime}
            {sessionWordsWritten > 0 && <span className="text-green-400">+{sessionWordsWritten}</span>}
          </div>

          {/* Status badge */}
          <button
            onClick={cycleStatus}
            title="Click to cycle status"
            className="btn btn-ghost btn-sm hidden sm:inline-flex text-foreground"
          >
            <span className={`size-1.5 rounded-full ${STATUS_DOTS[status] || STATUS_DOTS.Draft}`} /> {status}
          </button>

          {/* Notes toggle */}
          <button
            onClick={() => setShowNotes(n => !n)}
            title="Chapter notes"
            aria-pressed={showNotes}
            className={iconBtn(showNotes)}
          >
            <StickyNote />
          </button>

          {/* Chip toggle — preview only */}
          {mode === 'preview' && (
            <button
              onClick={() => setShowChips(s => !s)}
              title={showChips ? 'Hide entity chips' : 'Show entity chips'}
              aria-pressed={showChips}
              className={iconBtn(showChips)}
            >
              <Tag />
            </button>
          )}

          {/* Page size sliders */}
          <button
            onClick={() => setShowDimSliders(s => !s)}
            title="Adjust page size"
            aria-pressed={showDimSliders}
            className={iconBtn(showDimSliders)}
          >
            <SlidersHorizontal />
          </button>

          {/* Scene break */}
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => editorRef.current?.insertSceneBreak?.()}
              title="Insert scene break (* * *)"
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
            >
              <Rows3 /> Scene
            </button>
          )}

          {/* Find & replace */}
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => setShowFindReplace(true)}
              title="Find & replace in this chapter"
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
            >
              <Replace /> Replace
            </button>
          )}

          {/* Focus mode */}
          <button
            onClick={() => setFocusMode(f => !f)}
            title={focusMode ? 'Exit focus mode' : 'Focus mode'}
            className={iconBtn(false)}
          >
            {focusMode ? <Minimize2 /> : <Maximize2 />}
          </button>

          <div className="hidden sm:flex items-center gap-1 mx-1.5 text-xs text-muted-foreground">
            {saveState === 'saving'  && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
            {saveState === 'unsaved' && <span>Unsaved</span>}
            {saveState === 'saved'   && <><CheckCircle2 size={12} /> Saved</>}
            {saveState === 'error'   && <span className="text-destructive">Save failed</span>}
          </div>

          {/* Edit / Preview toggle */}
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'edit'}
              onClick={() => setMode('edit')}
              className="tab flex items-center gap-1.5"
            >
              <Edit3 size={12} /> <span className="hidden sm:inline">Edit</span>
            </button>
            <button
              role="tab"
              aria-selected={mode === 'preview'}
              onClick={() => setMode('preview')}
              className="tab flex items-center gap-1.5"
            >
              <Eye size={12} /> <span className="hidden sm:inline">Preview</span>
            </button>
          </div>

          <button
            onClick={() => doSave(title, content)}
            className="btn btn-primary ml-1 max-sm:btn-icon"
            title="Save"
          >
            <Save /><span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </header>

      {/* ── Body: canvas + notes ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Page canvas */}
        <main className="flex-1 overflow-y-auto bg-surface px-4 py-10 relative">

          {/* Dimension sliders panel */}
          {showDimSliders && (
            <div className="absolute top-3 right-3 z-20 bg-popover text-popover-foreground ring-1 ring-foreground/10 rounded-lg p-4 shadow-md w-64 space-y-4 animate-menu">
              <p className="section-title">Page size</p>

              {/* Presets */}
              <div className="space-y-1.5">
                <p className="section-label">Presets</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '5×8', w: 550, h: 900 },
                    { label: '6×9', w: 640, h: 960 },
                    { label: 'A5',  w: 560, h: 794 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => { setPageWidth(p.w); setPageHeight(p.h); }}
                      className={`h-7 rounded-md border text-xs font-medium transition-colors ${pageWidth === p.w && pageHeight === p.h ? 'bg-accent border-input text-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Width</span><span className="tabular-nums text-foreground">{pageWidth}px</span>
                </div>
                <input type="range" min={320} max={720} step={4} value={pageWidth}
                  onChange={e => setPageWidth(Number(e.target.value))}
                  className="w-full accent-brand" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Height</span><span className="tabular-nums text-foreground">{pageHeight}px</span>
                </div>
                <input type="range" min={400} max={1200} step={4} value={pageHeight}
                  onChange={e => setPageHeight(Number(e.target.value))}
                  className="w-full accent-brand" />
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
          <aside className="w-72 shrink-0 border-l border-sidebar-border bg-sidebar flex flex-col overflow-hidden">
            <div className="flex h-11 items-center justify-between pl-4 pr-2 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <StickyNote size={15} className="text-muted-foreground" />
                <span className="section-title">Chapter notes</span>
              </div>
              <button onClick={() => setShowNotes(false)} aria-label="Close notes" className="btn btn-ghost btn-icon btn-sm">
                <X />
              </button>
            </div>
            <TextareaAutosize
              value={notes}
              onChange={e => saveNotes(e.target.value)}
              placeholder="Jot down ideas, reminders, outline points for this chapter…"
              className="flex-1 bg-transparent text-sm text-foreground resize-none focus:outline-none px-4 py-3 leading-relaxed placeholder:text-muted-foreground/60"
            />
            <div className="px-4 py-2 border-t border-sidebar-border">
              <p className="text-xs text-muted-foreground">Notes are private — not exported with story text.</p>
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
