import TextareaAutosize from 'react-textarea-autosize';
import { useState, useMemo } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Plus, FileText, Pencil, Trash2,
  Scroll, BookMarked, Library, Feather, Search, X
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';

// Status shows as a small coloured dot beside a quiet label.
const STATUS_DOTS = {
  Draft:         'bg-yellow-500',
  'In Progress': 'bg-blue-500',
  Complete:      'bg-green-500',
};

const BOOK_GENRES = ['Fantasy', 'Horror', 'Romance', 'Mystery', 'Historical', 'Sci-Fi', 'Other'];
const BOOK_TYPES = ['book', 'tome', 'journal', 'scroll', 'letter', 'grimoire'];
const TYPE_LABELS = {
  book: 'Book', tome: 'Tome', journal: 'Journal',
  scroll: 'Scroll', letter: 'Letter', grimoire: 'Grimoire',
};

const DEFAULT_COVER_COLORS = ['#4c1d95', '#7f1d1d', '#14532d', '#1e3a5f', '#78350f', '#312e81', '#064e3b'];
const DEFAULT_SPINE_COLORS = ['#5b21b6', '#991b1b', '#166534', '#1e40af', '#92400e', '#3730a3', '#065f46'];



function BookCover({ book, size = 'shelf' }) {
  const coverColor = book.coverColor || DEFAULT_COVER_COLORS[Math.abs(book.id?.charCodeAt(0) || 0) % DEFAULT_COVER_COLORS.length];
  const spineColor = book.spineColor || DEFAULT_SPINE_COLORS[Math.abs(book.id?.charCodeAt(0) || 0) % DEFAULT_SPINE_COLORS.length];

  const isLarge = size === 'large';
  const width = isLarge ? 140 : 104;
  const height = isLarge ? 210 : 160;
  const spineW = isLarge ? 36 : 26;
  const pageW = isLarge ? 10 : 7;

  return (
    <div
      className="book-3d shrink-0 relative cursor-pointer"
      style={{ width: width + spineW + pageW, height }}
    >
      <div className="flex h-full" style={{ width: width + spineW + pageW }}>
        <div
          className="h-full flex flex-col items-center justify-between py-3 shrink-0 relative overflow-hidden"
          style={{ width: spineW, background: spineColor }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px)',
            }}
          />
          <div
            className="text-white/90 font-display text-center leading-none"
            style={{
              fontSize: isLarge ? 9 : 7,
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: 'rotate(180deg)',
              maxHeight: height - 24,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '0.05em',
            }}
          >
            {book.name}
          </div>
          {book.author && (
            <div
              className="text-white/50 font-display leading-none"
              style={{
                fontSize: 6,
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxHeight: 60,
                textOverflow: 'ellipsis',
              }}
            >
              {book.author}
            </div>
          )}
        </div>

        <div
          className="h-full flex flex-col items-center justify-between p-3 relative overflow-hidden"
          style={{ width, background: coverColor, flex: 1 }}
        >
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 5px)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)`,
            }}
          />
          <div className="absolute inset-0 rounded-r border border-white/5" />

          <div className="absolute top-2 right-2 opacity-30">
            <svg width={isLarge ? 20 : 14} height={isLarge ? 20 : 14} viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)" stroke="none">
              <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
            </svg>
          </div>
          <div className="absolute bottom-2 left-2 opacity-20">
            <svg width={isLarge ? 16 : 10} height={isLarge ? 16 : 10} viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)" stroke="none">
              <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
            </svg>
          </div>

          <div className="relative z-10 text-center mt-2">
            <p
              className="text-white font-display leading-tight"
              style={{ fontSize: isLarge ? 11 : 9, letterSpacing: '0.04em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
            >
              {book.name}
            </p>
            {book.subtitle && (
              <p
                className="text-white/60 font-story italic leading-tight mt-1"
                style={{ fontSize: isLarge ? 8 : 7 }}
              >
                {book.subtitle}
              </p>
            )}
          </div>
        </div>

        <div
          className="h-full shrink-0 rounded-r-sm"
          style={{ width: pageW, background: 'linear-gradient(to right, #e8dcc8, #f5f0e8)', opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

function BookModal({ initial = {}, onSave, onClose }) {
  const isEdit = !!initial.id;
  const colorIdx = Math.abs((initial.id || '').charCodeAt(0) || 0) % DEFAULT_COVER_COLORS.length;
  const [values, setValues] = useState({
    name: initial.name || '',
    subtitle: initial.subtitle || '',
    author: initial.author || '',
    genre: initial.genre || 'Fantasy',
    type: initial.type || 'book',
    coverColor: initial.coverColor || DEFAULT_COVER_COLORS[colorIdx],
    spineColor: initial.spineColor || DEFAULT_SPINE_COLORS[colorIdx],
    description: initial.description || '',
  });

  const set = (k, v) => setValues(prev => ({ ...prev, [k]: v }));

  const preview = { ...values, id: initial.id || 'preview' };

  return (
    <Modal title={isEdit ? 'Edit book' : 'New book'} onClose={onClose} size="lg">
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="shrink-0 flex flex-col items-center gap-3">
          <BookCover book={preview} />
          <p className="text-xs text-muted-foreground">Preview</p>
          <div className="flex gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cover</label>
              <input type="color" value={values.coverColor} onChange={e => set('coverColor', e.target.value)}
                className="w-8 h-8 rounded-md cursor-pointer border border-input bg-background" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Spine</label>
              <input type="color" value={values.spineColor} onChange={e => set('spineColor', e.target.value)}
                className="w-8 h-8 rounded-md cursor-pointer border border-input bg-background" />
            </div>
          </div>
        </div>

        <form
          className="flex-1 space-y-3"
          onSubmit={e => { e.preventDefault(); if (!values.name.trim()) return; onSave(values); }}
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Title *</label>
            <input autoFocus value={values.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. The Tome of Forgotten Names"
              className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Subtitle</label>
            <input value={values.subtitle} onChange={e => set('subtitle', e.target.value)}
              placeholder="Optional subtitle"
              className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Author</label>
            <input value={values.author} onChange={e => set('author', e.target.value)}
              placeholder="e.g. Eldrin the Scribe"
              className="input" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1.5">Genre</label>
              <select value={values.genre} onChange={e => set('genre', e.target.value)}
                className="input">
                {BOOK_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
              <select value={values.type} onChange={e => set('type', e.target.value)}
                className="input">
                {BOOK_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <TextareaAutosize value={values.description} onChange={e => set('description', e.target.value)}
              placeholder="Back cover blurb..."
              minRows={3}
              className="input resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="btn btn-outline">
              Cancel
            </button>
            <button type="submit"
              className="btn btn-primary">
              {isEdit ? 'Save changes' : 'Create book'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function LoosePageRow({ story, onEdit, onDelete }) {
  const navigate = useNavigate();
  const words = story.wordCount || 0;
  const status = story.status || 'Draft';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/stories/${story.id}`)}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/stories/${story.id}`); }}
      className="ios-row group flex items-center gap-3 px-4 py-2.5 bg-card text-sm transition-colors hover:bg-accent/60 cursor-pointer outline-none focus-visible:bg-accent/60"
    >
      <FileText size={16} className="shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{story.name}</p>
        {story.preview ? (
          <p className="text-xs text-muted-foreground truncate">{story.preview.slice(0, 80)}…</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">No content yet</p>
        )}
      </div>
      <div className="hidden md:flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
        <span className="tabular-nums">{words.toLocaleString()} words</span>
        <span className="flex items-center gap-1.5 w-24">
          <span className={`size-1.5 rounded-full ${STATUS_DOTS[status] || STATUS_DOTS.Draft}`} />
          {status}
        </span>
        <span className="w-14 text-right">
          {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
        </span>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={() => onEdit(story)} aria-label="Rename" title="Rename" className="btn btn-ghost btn-icon btn-sm">
          <Pencil />
        </button>
        <button onClick={() => onDelete(story)} aria-label="Delete" title="Delete" className="btn btn-ghost btn-icon btn-sm hover:text-destructive">
          <Trash2 />
        </button>
      </div>
    </div>
  );
}

function StandaloneChapterModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name || '');
  return (
    <Modal title={isEdit ? 'Rename page' : 'New loose page'} onClose={onClose} size="sm">
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. The Night of Falling Stars"
            className="input" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="btn btn-outline">
            Cancel
          </button>
          <button type="submit"
            className="btn btn-primary">
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Stories() {
  const navigate = useNavigate();
  const books = useWorldStore(state => state.books);
  const stories = useWorldStore(state => state.stories);
  const addBook = useWorldStore(state => state.addBook);
  const updateBook = useWorldStore(state => state.updateBook);
  const deleteBook = useWorldStore(state => state.deleteBook);
  const addEntity = useWorldStore(state => state.addEntity);
  const updateEntity = useWorldStore(state => state.updateEntity);
  const deleteEntity = useWorldStore(state => state.deleteEntity);

  const [addingBook, setAddingBook] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [deletingBook, setDeletingBook] = useState(null);
  const [addingStandalone, setAddingStandalone] = useState(false);
  const [editingStory, setEditingStory] = useState(null);
  const [deletingStory, setDeletingStory] = useState(null);
  const [selectedBookId, setSelectedBookId] = useState(null);

  const looseStories = useMemo(() => {
    return stories.filter(s => !s.bookId).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [stories]);

  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filteredBooks = useMemo(() => q ? books.filter(b => b.name?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)) : books, [books, q]);
  const filteredLoose = useMemo(() => q ? looseStories.filter(s => s.name?.toLowerCase().includes(q)) : looseStories, [looseStories, q]);

  const totalWords = stories.reduce((sum, s) => sum + (s.wordCount || 0), 0);

  const sortedBooks = [...books].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const activeBook = books.find(b => b.id === selectedBookId) || sortedBooks[0];

  return (
    <>
    <div className="flex-1 overflow-y-auto w-full">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-3 sm:px-8 md:pt-8 flex flex-col gap-4">
          <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="min-w-[16rem] flex-1">
              <div className="flex items-center gap-2.5">
                <Library size={20} className="shrink-0 text-muted-foreground" />
                <h1 className="page-title">Library</h1>
              </div>
              <p className="page-subtitle">
                {books.length} {books.length === 1 ? 'volume' : 'volumes'} · {looseStories.length} loose {looseStories.length === 1 ? 'page' : 'pages'} · {totalWords.toLocaleString()} words
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setAddingStandalone(true)} className="btn btn-outline">
                <Scroll /> New loose page
              </button>
              <button onClick={() => setAddingBook(true)} className="btn btn-primary">
                <Plus /> New book
              </button>
            </div>
          </header>
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search library…"
              className="input pl-8 pr-8"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-8 sm:px-8">
          {books.length === 0 && looseStories.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center rounded-lg border border-dashed border-border">
              <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <BookMarked size={18} />
              </span>
              <h3 className="text-sm font-semibold text-foreground">The shelves are bare</h3>
              <p className="mt-1 mb-4 text-sm text-muted-foreground max-w-xs">
                Every library begins with a single volume. Add your first book or write a loose page.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                <button onClick={() => setAddingStandalone(true)} className="btn btn-outline">
                  <Scroll /> New loose page
                </button>
                <button onClick={() => setAddingBook(true)} className="btn btn-primary">
                  <Plus /> Add first book
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {books.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="section-title">Volumes</h2>
                    <span className="text-xs text-muted-foreground">{books.length}</span>
                  </div>

                  {activeBook && (
                    <div className="card flex flex-col md:flex-row gap-8 p-6 md:p-8 items-center md:items-start">
                      <div className="shrink-0 drop-shadow-md">
                        <BookCover book={activeBook} size="large" />
                      </div>

                      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left w-full min-w-0 self-stretch">
                        <span className="badge mb-3">
                          {TYPE_LABELS[activeBook.type] || activeBook.type}
                          {activeBook.genre && <span className="text-muted-foreground/70">· {activeBook.genre}</span>}
                        </span>
                        <h3 className="text-xl font-bold tracking-[-0.02em] text-foreground">{activeBook.name}</h3>
                        {activeBook.subtitle && <p className="mt-1 text-[0.9375rem] text-muted-foreground">{activeBook.subtitle}</p>}
                        {activeBook.author && <p className="mt-1 text-sm text-muted-foreground">by {activeBook.author}</p>}

                        {activeBook.description && <p className="mt-4 text-sm text-muted-foreground max-w-lg leading-relaxed">{activeBook.description}</p>}

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-6 md:mt-auto md:pt-6">
                          <button onClick={() => navigate(`/books/${activeBook.id}`)} className="btn btn-primary">
                            <BookOpen /> Open book
                          </button>
                          <button onClick={() => setEditingBook(activeBook)} className="btn btn-outline">
                            <Pencil /> Edit details
                          </button>
                          <button onClick={() => setDeletingBook(activeBook)} className="btn btn-ghost hover:text-destructive">
                            <Trash2 /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <p className="section-label mb-3">Shelf</p>
                    <div className="flex flex-wrap gap-5 items-end pb-3">
                      {filteredBooks.map(book => {
                        const isActive = book.id === activeBook?.id;
                        return (
                          <div
                            key={book.id}
                            onClick={() => setSelectedBookId(book.id)}
                            className={`relative group cursor-pointer transition-all duration-300 ${isActive ? 'z-10' : 'opacity-75 hover:opacity-100 hover:-translate-y-1'}`}
                          >
                            <BookCover book={book} size="shelf" />
                            {isActive && (
                              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand" />
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setAddingBook(true)}
                        className="shrink-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input text-muted-foreground hover:border-ring hover:text-foreground hover:bg-accent/40 transition-colors"
                        style={{ width: 104 + 26 + 7, height: 160 }}
                      >
                        <Plus size={18} />
                        <span className="text-xs font-medium">Add book</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {filteredLoose.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Feather size={15} className="text-muted-foreground" />
                    <h2 className="section-title">Loose pages</h2>
                    <span className="text-xs text-muted-foreground">{filteredLoose.length}</span>
                    <button onClick={() => setAddingStandalone(true)} className="btn btn-ghost btn-sm ml-auto">
                      <Plus /> New
                    </button>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                    {filteredLoose
                      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                      .map(story => (
                        <LoosePageRow
                          key={story.id}
                          story={story}
                          onEdit={setEditingStory}
                          onDelete={setDeletingStory}
                        />
                      ))}
                  </div>
                </section>
              )}

              {books.length === 0 && looseStories.length > 0 && (
                <div className="flex justify-center pt-4">
                  <button onClick={() => setAddingBook(true)} className="btn btn-outline border-dashed">
                    <Plus /> Add your first book
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {addingBook && (
        <BookModal
          onSave={async (values) => { await addBook(values); setAddingBook(false); }}
          onClose={() => setAddingBook(false)}
        />
      )}

      {editingBook && (
        <BookModal
          initial={editingBook}
          onSave={async (values) => { await updateBook(editingBook.id, values); setEditingBook(null); }}
          onClose={() => setEditingBook(null)}
        />
      )}

      {deletingBook && (
        <ConfirmModal
          title="Delete Book"
          message={`Delete "${deletingBook.name}"? All chapters will become loose pages. This cannot be undone.`}
          onConfirm={async () => { await deleteBook(deletingBook.id); setDeletingBook(null); }}
          onClose={() => setDeletingBook(null)}
        />
      )}

      {addingStandalone && (
        <StandaloneChapterModal
          onSave={async (name) => {
            const saved = await addEntity('stories', { name, content: '', status: 'Draft', bookId: null });
            setAddingStandalone(false);
            if (saved?.id) navigate(`/stories/${saved.id}`);
          }}
          onClose={() => setAddingStandalone(false)}
        />
      )}

      {editingStory && (
        <StandaloneChapterModal
          initial={editingStory}
          onSave={async (name) => { await updateEntity('stories', editingStory.id, { name }); setEditingStory(null); }}
          onClose={() => setEditingStory(null)}
        />
      )}

      {deletingStory && (
        <ConfirmModal
          title="Delete Page"
          message={`Delete "${deletingStory.name}"? This cannot be undone.`}
          onConfirm={async () => { await deleteEntity('stories', deletingStory.id); setDeletingStory(null); }}
          onClose={() => setDeletingStory(null)}
        />
      )}
    </>
  );
}
