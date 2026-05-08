import { useState } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Plus, FileText, Pencil, Trash2,
  Scroll, BookMarked, Library, Feather,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';

const STATUS_STYLES = {
  Draft:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'In Progress': 'bg-blue-500/10  text-blue-400  border-blue-500/20',
  Complete:      'bg-green-500/10 text-green-400  border-green-500/20',
};

const BOOK_GENRES = ['Fantasy', 'Horror', 'Romance', 'Mystery', 'Historical', 'Sci-Fi', 'Other'];
const BOOK_TYPES = ['book', 'tome', 'journal', 'scroll', 'letter', 'grimoire'];
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
    <Modal title={isEdit ? 'Edit Book' : 'New Book'} onClose={onClose} size="lg">
      <div className="flex gap-6">
        <div className="shrink-0 flex flex-col items-center gap-3">
          <BookCover book={preview} />
          <p className="text-xs text-muted-foreground">Preview</p>
          <div className="flex gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cover</label>
              <input type="color" value={values.coverColor} onChange={e => set('coverColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Spine</label>
              <input type="color" value={values.spineColor} onChange={e => set('spineColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" />
            </div>
          </div>
        </div>

        <form
          className="flex-1 space-y-3"
          onSubmit={e => { e.preventDefault(); if (!values.name.trim()) return; onSave(values); }}
        >
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Title *</label>
            <input autoFocus value={values.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. The Tome of Forgotten Names"
              className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Subtitle</label>
            <input value={values.subtitle} onChange={e => set('subtitle', e.target.value)}
              placeholder="Optional subtitle"
              className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Author</label>
            <input value={values.author} onChange={e => set('author', e.target.value)}
              placeholder="e.g. Eldrin the Scribe"
              className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-foreground mb-1">Genre</label>
              <select value={values.genre} onChange={e => set('genre', e.target.value)}
                className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring">
                {BOOK_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-foreground mb-1">Type</label>
              <select value={values.type} onChange={e => set('type', e.target.value)}
                className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring">
                {BOOK_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Description</label>
            <textarea value={values.description} onChange={e => set('description', e.target.value)}
              placeholder="Back cover blurb..."
              rows={3}
              className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              {isEdit ? 'Save Changes' : 'Create Book'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function LoosePageRow({ story, onEdit, onDelete }) {
  const navigate = useNavigate();
  const words = wordCount(story.content);
  const statusStyle = STATUS_STYLES[story.status] || STATUS_STYLES.Draft;

  return (
    <div
      onClick={() => navigate(`/stories/${story.id}`)}
      className="group flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/50 hover:border-border transition-colors cursor-pointer"
    >
      <div className="shrink-0 w-8 h-8 rounded bg-background border border-border flex items-center justify-center">
        <FileText size={14} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {story.name}
        </p>
        {story.content ? (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{cleanPreview(story.content).slice(0, 80)}…</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic mt-0.5">No content yet</p>
        )}
      </div>
      <div className="hidden md:flex items-center gap-4 shrink-0">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText size={11} /> {words.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">
          {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle}`}>
          {story.status || 'Draft'}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={() => onEdit(story)}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Pencil size={12} />
        </button>
        <button onClick={() => onDelete(story)}
          className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function StandaloneChapterModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name || '');
  return (
    <Modal title={isEdit ? 'Rename Page' : 'New Standalone Chapter'} onClose={onClose} size="sm">
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. The Night of Falling Stars"
            className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="submit"
            className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
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

  const looseStories = stories.filter(s => !s.bookId);
  const totalWords = stories.reduce((sum, s) => sum + wordCount(s.content), 0);

  const sortedBooks = [...books].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const activeBook = books.find(b => b.id === selectedBookId) || sortedBooks[0];

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-border bg-card shrink-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Library size={22} className="text-violet-400" />
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Library</h2>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">
                {books.length} {books.length === 1 ? 'volume' : 'volumes'} · {looseStories.length} loose {looseStories.length === 1 ? 'page' : 'pages'} · {totalWords.toLocaleString()} total words
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddingStandalone(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Scroll size={14} /> New Loose Page
              </button>
              <button
                onClick={() => setAddingBook(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-md text-sm font-medium transition-colors"
              >
                <Plus size={15} /> New Book
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {books.length === 0 && looseStories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center pb-16">
              <div className="w-20 h-20 rounded-2xl bg-amber-900/20 border border-amber-800/20 flex items-center justify-center mb-4">
                <BookMarked size={32} className="text-amber-600/60" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">The shelves are bare</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Every library begins with a single volume. Add your first book or write a loose page.
              </p>
              <button
                onClick={() => setAddingBook(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-5 rounded-md text-sm font-medium transition-colors"
              >
                <Plus size={15} /> Add First Book
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {books.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <BookMarked size={16} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Volumes & Tomes</h3>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {activeBook && (
                    <div className="flex flex-col md:flex-row gap-8 bg-secondary/20 border border-border rounded-2xl p-8 items-center md:items-start relative overflow-hidden">
                      <div className="absolute -right-20 -top-20 opacity-5 blur-3xl pointer-events-none">
                        <div className="w-96 h-96 rounded-full" style={{ background: activeBook.coverColor }} />
                      </div>
                      
                      <div className="shrink-0 drop-shadow-2xl">
                        <BookCover book={activeBook} size="large" />
                      </div>
                      
                      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left z-10 w-full">
                        <div className="inline-block px-3 py-1 rounded-full bg-secondary border border-border text-xs text-muted-foreground mb-4">
                          {TYPE_LABELS[activeBook.type] || activeBook.type}
                        </div>
                        <h2 className="text-3xl font-bold text-foreground mb-2">{activeBook.name}</h2>
                        {activeBook.subtitle && <p className="text-lg text-muted-foreground mb-2">{activeBook.subtitle}</p>}
                        {activeBook.author && <p className="text-sm text-muted-foreground mb-6">by {activeBook.author}</p>}
                        
                        {activeBook.description && <p className="text-sm text-muted-foreground mb-6 max-w-lg leading-relaxed">{activeBook.description}</p>}
                        
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-auto">
                          <button onClick={() => navigate(`/books/${activeBook.id}`)} className="h-10 px-6 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
                            <BookOpen size={16} /> Open Book
                          </button>
                          <button onClick={() => setEditingBook(activeBook)} className="h-10 px-4 rounded-lg bg-secondary text-foreground font-medium border border-border hover:bg-secondary/80 transition-colors">
                            Edit Details
                          </button>
                          <button onClick={() => setDeletingBook(activeBook)} className="h-10 px-4 rounded-lg bg-transparent text-muted-foreground font-medium hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-secondary/10 border border-border rounded-xl p-6">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">Your Shelf</h4>
                    <div className="flex flex-wrap gap-5 items-end">
                      {sortedBooks.map(book => {
                        const isActive = book.id === activeBook?.id;
                        return (
                          <div 
                            key={book.id} 
                            onClick={() => setSelectedBookId(book.id)}
                            className={`relative group cursor-pointer transition-all duration-300 ${isActive ? 'scale-105 z-10' : 'opacity-70 hover:opacity-100 hover:-translate-y-2'}`}
                          >
                            <BookCover book={book} size="shelf" />
                            {isActive && (
                              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setAddingBook(true)}
                        className="shrink-0 flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                        style={{ width: 104 + 26 + 7, height: 160 }}
                      >
                        <Plus size={18} />
                        <span className="text-xs font-medium">Add Book</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {looseStories.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4 mt-8">
                    <Feather size={16} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Loose Pages</h3>
                    <div className="flex-1 h-px bg-border" />
                    <button
                      onClick={() => setAddingStandalone(true)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> New
                    </button>
                  </div>
                  <div className="space-y-2">
                    {looseStories
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
                  <button
                    onClick={() => setAddingBook(true)}
                    className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium border border-dashed border-amber-900/40 text-amber-800/60 hover:text-amber-600/80 hover:border-amber-700/50 transition-colors"
                  >
                    <Plus size={14} /> Add your first book
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
