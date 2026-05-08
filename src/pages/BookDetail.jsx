import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import {
  ArrowLeft, Plus, Trash2, GripVertical,
  FileText, Clock, ArrowRight, BookOpen, LayoutGrid, List, Download,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { compileHtmlManuscript, downloadTextFile, buildEpubBlob, downloadBlob } from '../lib/exportBook';

const STATUS_STYLES = {
  Draft:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'In Progress': 'bg-blue-500/10  text-blue-400  border-blue-500/20',
  Complete:      'bg-green-500/10 text-green-400  border-green-500/20',
};

const TYPE_LABELS = {
  book: 'Book', tome: 'Tome', journal: 'Journal',
  scroll: 'Scroll', letter: 'Letter', grimoire: 'Grimoire',
};

const DEFAULT_COVER_COLORS = ['#4c1d95', '#7f1d1d', '#14532d', '#1e3a5f', '#78350f', '#312e81', '#064e3b'];
const DEFAULT_SPINE_COLORS = ['#5b21b6', '#991b1b', '#166534', '#1e40af', '#92400e', '#3730a3', '#065f46'];

function wordCount(text) {
  if (!text) return 0;
  return text.replace(/\f/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}
function cleanPreview(text) {
  if (!text) return '';
  return text.replace(/\f/g, ' ').replace(/\s+/g, ' ').trim();
}

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
    <Modal title="New Chapter" onClose={onClose} size="sm">
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Chapter Title</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. The First Betrayal"
            className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="submit"
            className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Add Chapter
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChapterRow({ story, index, onDelete, onDragStart, onDragEnter, onDragEnd }) {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = useState(false);
  const words = wordCount(story.content);
  const statusStyle = STATUS_STYLES[story.status] || STATUS_STYLES.Draft;

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragEnter={() => { setIsDragOver(true); onDragEnter(index); }}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={e => e.preventDefault()}
      onDrop={() => setIsDragOver(false)}
      onDragEnd={() => { setIsDragOver(false); onDragEnd(); }}
      className={`group flex items-center gap-4 px-4 py-3 border-b transition-colors cursor-pointer select-none
        ${isDragOver ? 'bg-primary/5 border-b-primary/30' : 'border-b-border hover:bg-secondary/30'}`}
    >
      <div className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors opacity-0 group-hover:opacity-100"
        onClick={e => e.stopPropagation()}>
        <GripVertical size={14} />
      </div>

      <div className="shrink-0 w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center"
        onClick={() => navigate(`/stories/${story.id}`)}>
        <span className="text-xs font-medium text-muted-foreground">{story.chapterNumber || index + 1}</span>
      </div>

      <div className="flex-1 min-w-0" onClick={() => navigate(`/stories/${story.id}`)}>
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {story.name}
        </p>
        {story.content ? (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{cleanPreview(story.content).slice(0, 80)}…</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic mt-0.5">No content yet</p>
        )}
      </div>

      <div className="hidden md:flex items-center gap-4 shrink-0" onClick={() => navigate(`/stories/${story.id}`)}>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText size={11} /> {words.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock size={11} /> {readingTime(words)}
        </span>
        <span className="text-xs text-muted-foreground w-20 text-right">
          {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyle}`}>
          {story.status || 'Draft'}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}>
        <button onClick={() => onDelete(story)}
          className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      <ArrowRight size={14} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => navigate(`/stories/${story.id}`)} />
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
        <BookOpen size={32} className="opacity-40" />
        <p>Book not found.</p>
        <button onClick={() => navigate('/stories')}
          className="text-sm text-primary hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Library
        </button>
      </div>
    );
  }

  const totalWords = chapters.reduce((sum, s) => sum + wordCount(s.content), 0);

  return (
    <>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <aside
          className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto p-6 flex flex-col gap-5"
          style={{ background: 'linear-gradient(160deg, rgba(120,70,20,0.06) 0%, rgba(50,30,10,0.1) 100%)' }}
        >
          <button
            onClick={() => navigate('/stories')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <ArrowLeft size={14} /> Library
          </button>

          <div className="flex justify-center">
            <BookCoverLarge book={book} />
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-xl font-bold text-foreground leading-tight">{book.name}</h1>
            {book.subtitle && (
              <p className="text-sm font-medium italic text-muted-foreground">{book.subtitle}</p>
            )}
            {book.author && (
              <p className="text-xs text-muted-foreground">by {book.author}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {book.genre && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                {book.genre}
              </span>
            )}
            {book.type && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-900/20 border border-amber-800/20 text-amber-600/80">
                {TYPE_LABELS[book.type] || book.type}
              </span>
            )}
          </div>

          {book.description && (
            <p className="text-sm text-muted-foreground leading-relaxed text-center italic">
              "{book.description}"
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-secondary/60 border border-border p-3 text-center">
              <p className="text-lg font-semibold text-foreground">{chapters.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Chapters</p>
            </div>
            <div className="rounded-lg bg-secondary/60 border border-border p-3 text-center">
              <p className="text-lg font-semibold text-foreground">{totalWords.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Words</p>
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
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalWords >= book.wordGoal ? 'bg-green-400' : 'bg-primary'}`}
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
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors text-center w-full"
            >
              + Set word goal
            </button>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Chapters</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border bg-secondary/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setChapterView('list')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${chapterView === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="List view"
                >
                  <List size={13} /> List
                </button>
                <button
                  type="button"
                  onClick={() => setChapterView('corkboard')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${chapterView === 'corkboard' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Outline / corkboard"
                >
                  <LayoutGrid size={13} /> Outline
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCompileOpen(true)}
                className="flex items-center gap-2 border border-border bg-secondary/60 hover:bg-secondary text-foreground h-8 px-3 rounded-md text-sm font-medium transition-colors"
              >
                <Download size={13} /> Compile
              </button>
              <button
                onClick={() => setAddingChapter(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 rounded-md text-sm font-medium transition-colors"
              >
                <Plus size={13} /> Add Chapter
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {chapters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center pb-16 px-8">
                <div className="w-14 h-14 rounded-xl bg-secondary border border-border flex items-center justify-center mb-4">
                  <BookOpen size={22} className="text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No chapters yet</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs italic">
                  The first words of every great tale begin with a single chapter.
                </p>
                <button
                  onClick={() => setAddingChapter(true)}
                  className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-5 rounded-md text-sm font-medium transition-colors"
                >
                  <Plus size={14} /> Write First Chapter
                </button>
              </div>
            ) : chapterView === 'corkboard' ? (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => navigate(`/stories/${chapter.id}`)}
                    className="text-left rounded-xl border border-border bg-card hover:bg-secondary/40 hover:border-primary/30 transition-all p-4 flex flex-col gap-2 min-h-[120px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-6">{chapter.chapterNumber ?? index + 1}</span>
                      <span className="text-sm font-semibold text-foreground line-clamp-2">{chapter.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-4 flex-1">
                      {(chapter.content || '').replace(/\f/g, ' ').replace(/\[\[(.*?)\]\]/g, '$1').trim().slice(0, 220) || 'Empty chapter'}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60">{wordCount(chapter.content)} words</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {chapters.length > 0 && (
                  <div className="px-4 py-2 border-b border-border">
                    <div className="hidden md:flex items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <div className="w-4 shrink-0" />
                      <div className="w-7 shrink-0" />
                      <div className="flex-1">Chapter</div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="w-20 text-right">Words</span>
                        <span className="w-20 text-right">Read time</span>
                        <span className="w-28 text-right">Last edited</span>
                        <span className="w-20 text-center">Status</span>
                        <span className="w-10" />
                        <span className="w-4" />
                      </div>
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
            Exports combine every chapter in order. <code className="text-xs bg-secondary px-1 rounded">[[mentions]]</code> become plain names. Use Print for a PDF via your browser.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              className="h-10 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-sm font-medium text-foreground transition-colors"
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
              className="h-10 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-sm font-medium text-foreground transition-colors"
              onClick={async () => {
                const slug = (book.name || 'book').replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'book';
                const blob = await buildEpubBlob(book, chapters);
                downloadBlob(`${slug}.epub`, blob);
              }}
            >
              Download EPUB
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-sm font-medium text-foreground transition-colors"
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
              className="h-10 rounded-lg border border-primary/40 bg-primary/15 hover:bg-primary/25 text-sm font-medium text-primary transition-colors"
              onClick={() => {
                const html = compileHtmlManuscript(book, chapters);
                const w = window.open('', '_blank');
                if (!w) return;
                w.document.write(html);
                w.document.close();
                w.focus();
                requestAnimationFrame(() => { try { w.print(); } catch { /* browser print edge cases */ } });
              }}
            >
              Print / Save as PDF…
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCompileOpen(false)}
            className="mt-4 w-full h-9 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Close
          </button>
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
