import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import {
  ArrowLeft, Plus, Trash2, GripVertical,
  ArrowRight, BookOpen, LayoutGrid, List, Download, Target,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { compileHtmlManuscript, downloadTextFile, downloadBlob } from '../lib/exportBook';
import { api } from '../lib/api';

const STATUS_DOTS = {
  Draft:         'bg-yellow-500',
  'In Progress': 'bg-blue-500',
  Complete:      'bg-green-500',
};

const TYPE_LABELS = {
  book: 'Book', tome: 'Tome', journal: 'Journal',
  scroll: 'Scroll', letter: 'Letter', grimoire: 'Grimoire',
};

const DEFAULT_COVER_COLORS = ['#4c1d95', '#7f1d1d', '#14532d', '#1e3a5f', '#78350f', '#312e81', '#064e3b'];
const DEFAULT_SPINE_COLORS = ['#5b21b6', '#991b1b', '#166534', '#1e40af', '#92400e', '#3730a3', '#065f46'];



function readingTime(words) {
  const mins = Math.ceil(words / 200);
  return mins < 1 ? '<1 min' : `${mins} min`;
}

function BookCoverLarge({ book }) {
  const coverColor = book.coverColor || DEFAULT_COVER_COLORS[Math.abs(book.id?.charCodeAt(0) || 0) % DEFAULT_COVER_COLORS.length];
  const spineColor = book.spineColor || DEFAULT_SPINE_COLORS[Math.abs(book.id?.charCodeAt(0) || 0) % DEFAULT_SPINE_COLORS.length];
  const width = 140;
  const height = 210;
  const spineW = 36;
  const pageW = 10;

  return (
    <div
      className="book-3d shrink-0 mx-auto"
      style={{ width: width + spineW + pageW, height }}
    >
      <div className="flex h-full">
        <div
          className="h-full flex flex-col items-center justify-between py-3 shrink-0 relative overflow-hidden"
          style={{ width: spineW, background: spineColor }}
        >
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px)',
          }} />
          <div className="text-white/90 font-display text-center leading-none" style={{
            fontSize: 9, writingMode: 'vertical-rl', textOrientation: 'mixed',
            transform: 'rotate(180deg)', maxHeight: height - 24, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.05em',
          }}>
            {book.name}
          </div>
          {book.author && (
            <div className="text-white/50 font-display leading-none" style={{
              fontSize: 6, writingMode: 'vertical-rl', textOrientation: 'mixed',
              transform: 'rotate(180deg)', overflow: 'hidden', whiteSpace: 'nowrap',
              maxHeight: 60, textOverflow: 'ellipsis',
            }}>
              {book.author}
            </div>
          )}
        </div>

        <div className="h-full flex flex-col items-center justify-between p-3 relative overflow-hidden"
          style={{ width, background: coverColor, flex: 1 }}>
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 5px)',
          }} />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
          }} />
          <div className="absolute inset-0 rounded-r border border-white/5" />

          <div className="absolute top-3 right-3 opacity-30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)" stroke="none">
              <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
            </svg>
          </div>
          <div className="absolute bottom-3 left-3 opacity-20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)" stroke="none">
              <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
            </svg>
          </div>

          <div className="relative z-10 text-center mt-2">
            <p className="text-white font-display leading-tight" style={{ fontSize: 11, letterSpacing: '0.04em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
              {book.name}
            </p>
            {book.subtitle && (
              <p className="text-white/60 font-story italic leading-tight mt-1" style={{ fontSize: 8 }}>
                {book.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="h-full shrink-0 rounded-r-sm" style={{
          width: pageW, background: 'linear-gradient(to right, #e8dcc8, #f5f0e8)', opacity: 0.85,
        }} />
      </div>
    </div>
  );
}

function AddChapterModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  return (
    <Modal title="New chapter" onClose={onClose} size="sm">
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Chapter title</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. The First Betrayal"
            className="input" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add chapter
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChapterRow({ story, index, onDelete, onDragStart, onDragEnter, onDragEnd }) {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = useState(false);
  const words = story.wordCount || 0;
  const status = story.status || 'Draft';
  const open = () => navigate(`/stories/${story.id}`);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragEnter={() => { setIsDragOver(true); onDragEnter(index); }}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={e => e.preventDefault()}
      onDrop={() => setIsDragOver(false)}
      onDragEnd={() => { setIsDragOver(false); onDragEnd(); }}
      className={`ios-row group flex items-center gap-3 px-3 py-2.5 border-b transition-colors cursor-pointer select-none
        ${isDragOver ? 'bg-brand-soft border-b-brand/40' : 'border-b-border hover:bg-accent/60'}`}
    >
      <div className="shrink-0 w-4 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors opacity-0 group-hover:opacity-100"
        onClick={e => e.stopPropagation()}>
        <GripVertical size={14} />
      </div>

      <div className="shrink-0 w-7 text-right text-sm tabular-nums text-muted-foreground" onClick={open}>
        {story.chapterNumber || index + 1}
      </div>

      <div className="flex-1 min-w-0" onClick={open}>
        <p className="text-sm font-medium text-foreground truncate">
          {story.name}
        </p>
        {story.preview ? (
          <p className="text-xs text-muted-foreground truncate">{story.preview.slice(0, 80)}…</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">No content yet</p>
        )}
      </div>

      <div className="hidden md:flex items-center gap-4 shrink-0 text-xs text-muted-foreground tabular-nums" onClick={open}>
        <span className="w-20 text-right">{words.toLocaleString()}</span>
        <span className="w-20 text-right">{readingTime(words)}</span>
        <span className="w-28 text-right">
          {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
        <span className="w-24 flex items-center gap-1.5 pl-3">
          <span className={`size-1.5 rounded-full ${STATUS_DOTS[status] || STATUS_DOTS.Draft}`} />
          {status}
        </span>
      </div>

      <div className="flex w-8 justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}>
        <button onClick={() => onDelete(story)} aria-label="Delete chapter" title="Delete chapter"
          className="btn btn-ghost btn-icon btn-sm hover:text-destructive">
          <Trash2 />
        </button>
      </div>

      <ArrowRight size={14} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={open} />
    </div>
  );
}

export default function BookDetail() {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const books = useWorldStore(state => state.books);
  const stories = useWorldStore(state => state.stories);
  const updateBook = useWorldStore(state => state.updateBook);
  const addEntity = useWorldStore(state => state.addEntity);
  const deleteEntity = useWorldStore(state => state.deleteEntity);
  const reorderChapters = useWorldStore(state => state.reorderChapters);
  const fetchEntityContent = useWorldStore(state => state.fetchEntityContent);

  const book = books.find(b => b.id === bookId);
  const chapters = stories
    .filter(s => s.bookId === bookId)
    .sort((a, b) => {
      if (a.chapterNumber != null && b.chapterNumber != null) return a.chapterNumber - b.chapterNumber;
      if (a.chapterNumber != null) return -1;
      if (b.chapterNumber != null) return 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

  const [addingChapter, setAddingChapter] = useState(false);
  const [deletingChapter, setDeletingChapter] = useState(null);
  const [chapterView, setChapterView] = useState('list'); // 'list' | 'corkboard'
  const [compileOpen, setCompileOpen] = useState(false);

  // Fetch full content of all book chapters when compile modal is opened
  useEffect(() => {
    if (compileOpen) {
      const missing = chapters.filter(c => c.content === undefined || c.content === null);
      if (missing.length > 0) {
        Promise.all(missing.map(c => fetchEntityContent('stories', c.id)));
      }
    }
  }, [compileOpen, chapters, fetchEntityContent]);

  const dragIndex = useRef(null);
  const hoverIndex = useRef(null);

  const handleDragStart = useCallback((index) => { dragIndex.current = index; }, []);
  const handleDragEnter = useCallback((index) => { hoverIndex.current = index; }, []);
  const handleDragEnd = useCallback(() => {
    const from = dragIndex.current;
    const to = hoverIndex.current;
    if (from == null || to == null || from === to) {
      dragIndex.current = null;
      hoverIndex.current = null;
      return;
    }
    const reordered = [...chapters];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderChapters(bookId, reordered.map(s => s.id));
    dragIndex.current = null;
    hoverIndex.current = null;
  }, [chapters, bookId, reorderChapters]);

  if (!book) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <BookOpen size={28} className="opacity-40" />
        <p className="text-sm">Book not found.</p>
        <button onClick={() => navigate('/stories')} className="btn btn-outline">
          <ArrowLeft /> Back to Library
        </button>
      </div>
    );
  }

  const totalWords = chapters.reduce((sum, s) => sum + (s.wordCount || 0), 0);

  return (
    <>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <aside
          className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-sidebar-border bg-sidebar overflow-y-auto px-4 pt-3 pb-6 flex flex-col gap-5"
        >
          <button
            onClick={() => navigate('/stories')}
            className="btn btn-ghost btn-sm self-start -ml-1"
          >
            <ArrowLeft /> Library
          </button>

          <div className="flex justify-center drop-shadow-md">
            <BookCoverLarge book={book} />
          </div>

          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold tracking-[-0.02em] text-foreground leading-tight">{book.name}</h1>
            {book.subtitle && (
              <p className="text-sm text-muted-foreground">{book.subtitle}</p>
            )}
            {book.author && (
              <p className="text-xs text-muted-foreground">by {book.author}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {book.type && <span className="badge">{TYPE_LABELS[book.type] || book.type}</span>}
            {book.genre && <span className="badge">{book.genre}</span>}
          </div>

          {book.description && (
            <p className="text-sm text-muted-foreground leading-relaxed text-center">
              {book.description}
            </p>
          )}

          <div className="card grid grid-cols-2 divide-x divide-border">
            <div className="p-3 text-center">
              <p className="text-lg font-semibold tabular-nums text-foreground">{chapters.length}</p>
              <p className="text-xs text-muted-foreground">Chapters</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-lg font-semibold tabular-nums text-foreground">{totalWords.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Words</p>
            </div>
          </div>

          {/* Completion bar — based on word goal */}
          {book.wordGoal && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className={totalWords >= book.wordGoal ? 'text-green-400 font-semibold' : 'text-muted-foreground'}>
                  {Math.min(100, Math.round((totalWords / book.wordGoal) * 100))}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalWords >= book.wordGoal ? 'bg-green-500' : 'bg-brand'}`}
                  style={{ width: `${Math.min(100, (totalWords / book.wordGoal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{totalWords.toLocaleString()} / {book.wordGoal.toLocaleString()} words</p>
            </div>
          )}
          {!book.wordGoal && (
            <button
              onClick={async () => {
                const goal = parseInt(prompt('Set a word count goal for this book (e.g. 80000):'), 10);
                if (!isNaN(goal) && goal > 0) await updateBook(bookId, { wordGoal: goal });
              }}
              className="btn btn-ghost btn-sm self-center"
            >
              <Target /> Set word goal
            </button>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="section-title">Chapters</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{chapters.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={chapterView === 'list'}
                  onClick={() => setChapterView('list')}
                  className="tab flex items-center gap-1"
                  title="List view"
                >
                  <List size={13} /> List
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chapterView === 'corkboard'}
                  onClick={() => setChapterView('corkboard')}
                  className="tab flex items-center gap-1"
                  title="Outline / corkboard"
                >
                  <LayoutGrid size={13} /> Outline
                </button>
              </div>
              <button type="button" onClick={() => setCompileOpen(true)} className="btn btn-outline">
                <Download /> Compile
              </button>
              <button onClick={() => setAddingChapter(true)} className="btn btn-primary">
                <Plus /> Add chapter
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {chapters.length === 0 ? (
              <div className="m-4 sm:m-6 flex flex-col items-center justify-center text-center px-6 py-14 rounded-lg border border-dashed border-border">
                <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <BookOpen size={18} />
                </span>
                <h3 className="text-sm font-semibold text-foreground">No chapters yet</h3>
                <p className="mt-1 mb-4 text-sm text-muted-foreground max-w-xs">
                  The first words of every great tale begin with a single chapter.
                </p>
                <button onClick={() => setAddingChapter(true)} className="btn btn-primary">
                  <Plus /> Write first chapter
                </button>
              </div>
            ) : chapterView === 'corkboard' ? (
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => navigate(`/stories/${chapter.id}`)}
                    className="card card-hover text-left p-4 flex flex-col gap-2 min-h-[120px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground w-5 shrink-0">{chapter.chapterNumber ?? index + 1}</span>
                      <span className="text-sm font-semibold text-foreground line-clamp-2">{chapter.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-4 flex-1">
                      {chapter.preview ? chapter.preview.replace(/\[\[(.*?)\]\]/g, '$1').slice(0, 220) : 'Empty chapter'}
                    </p>
                    <span className="text-xs text-muted-foreground">{(chapter.wordCount || 0).toLocaleString()} words</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {chapters.length > 0 && (
                  <div className="hidden md:block px-3 py-2 border-b border-border bg-surface">
                    <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                      <div className="w-4 shrink-0" />
                      <div className="w-7 shrink-0 text-right">#</div>
                      <div className="flex-1">Chapter</div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="w-20 text-right">Words</span>
                        <span className="w-20 text-right">Read time</span>
                        <span className="w-28 text-right">Last edited</span>
                        <span className="w-24 pl-3">Status</span>
                      </div>
                      <span className="w-8 shrink-0" />
                      <span className="w-3.5 shrink-0" />
                    </div>
                  </div>
                )}
                <div>
                  {chapters.map((chapter, index) => (
                    <ChapterRow
                      key={chapter.id}
                      story={chapter}
                      index={index}
                      onDelete={setDeletingChapter}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {compileOpen && (
        <Modal title="Compile manuscript" onClose={() => setCompileOpen(false)} size="md">
          <p className="text-sm text-muted-foreground mb-4">
            Exports combine every chapter in order. <code className="text-xs bg-muted px-1 rounded">[[mentions]]</code> become plain names. Use Print for a PDF via your browser.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-outline h-9 w-full"
              onClick={() => {
                const html = compileHtmlManuscript(book, chapters);
                const slug = (book.name || 'book').replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'book';
                downloadTextFile(`${slug}.html`, html, 'text/html;charset=utf-8');
              }}
            >
              Download HTML
            </button>
            <button
              type="button"
              className="btn btn-outline h-9 w-full"
              onClick={async () => {
                try {
                  await api.exportEpub({
                    title: book.name || 'Realm Lore Export',
                    author: book.author || 'Unknown',
                    chapters: chapters.map(c => {
                      let html = '';
                      for (const p of (c.content || '').replace(/\f/g, '\n\n').split(/\n+/)) {
                        const t = p.trim();
                        if (!t) continue;
                        const plain = t.replace(/\[\[([^\]]+)\]\]/g, '$1');
                        if (plain === '* * *' || plain === '***') html += '<p style="text-align:center">* * *</p>';
                        else html += `<p>${plain}</p>`;
                      }
                      return { title: c.name || 'Untitled', html };
                    })
                  });
                } catch (e) {
                  console.error('EPUB Export failed', e);
                }
              }}
            >
              Download EPUB
            </button>
            <button
              type="button"
              className="btn btn-outline h-9 w-full"
              onClick={() => {
                const html = compileHtmlManuscript(book, chapters);
                const slug = (book.name || 'book').replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'book';
                const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
                downloadBlob(`${slug}.doc`, blob);
              }}
            >
              Download Word (.doc)
            </button>
            <button
              type="button"
              className="btn btn-primary h-9 w-full"
              onClick={async () => {
                const html = compileHtmlManuscript(book, chapters);
                try {
                  await api.exportPdf({ title: book.name || 'Realm Lore Export', htmlContent: html });
                } catch (err) {
                  console.error('PDF Export failed', err);
                  alert(err.message);
                }
              }}
            >
              Print / Save as PDF…
            </button>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => setCompileOpen(false)} className="btn btn-ghost">
              Close
            </button>
          </div>
        </Modal>
      )}

      {addingChapter && (
        <AddChapterModal
          onSave={async (name) => {
            const nextNum = chapters.length + 1;
            const saved = await addEntity('stories', {
              name,
              content: '',
              status: 'Draft',
              bookId,
              chapterNumber: nextNum,
            });
            setAddingChapter(false);
            if (saved?.id) navigate(`/stories/${saved.id}`);
          }}
          onClose={() => setAddingChapter(false)}
        />
      )}

      {deletingChapter && (
        <ConfirmModal
          title="Delete Chapter"
          message={`Delete "${deletingChapter.name}"? It moves to Trash — you can restore it from Settings → Trash.`}
          onConfirm={async () => { await deleteEntity('stories', deletingChapter.id); setDeletingChapter(null); }}
          onClose={() => setDeletingChapter(null)}
        />
      )}
    </>
  );
}
