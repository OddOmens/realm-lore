import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { Users, Map, Box, BookMarked } from 'lucide-react';
import { serializeNode, getCaretOffset, setCaretOffset, stripBrackets, buildEditHTML } from './richEditor';

const PAGE_SEP = '\f';
const FONT_SIZE = 15;
const LINE_HEIGHT = 1.625;
const MENTION_LIMIT = 24;

const TYPE_META = {
  characters: { icon: Users,      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30'  },
  locations:  { icon: Map,        color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  things:     { icon: Box,        color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  lore:       { icon: BookMarked, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30'},
};

function parsePages(v) { return v ? v.split(PAGE_SEP) : ['']; }
function joinPages(p)   { return p.join(PAGE_SEP); }
function readDOM(el)    { return serializeNode(el).replace(/\n$/, ''); }

function flattenPages(pages) {
  return pages.map(page => stripBrackets(page || '')).join('');
}

function normalizeValue(value) {
  return flattenPages(parsePages(value));
}

// Find a graceful place to break a page near maxOffset (newline > sentence > word > hard).
function pickSplitPoint(text, maxOffset) {
  if (maxOffset >= text.length) return text.length;
  const safeOffset = Math.max(1, maxOffset);
  const newline = text.lastIndexOf('\n', safeOffset);
  const sentence = Math.max(
    text.lastIndexOf('. ', safeOffset),
    text.lastIndexOf('? ', safeOffset),
    text.lastIndexOf('! ', safeOffset)
  );
  const space = text.lastIndexOf(' ', safeOffset);

  if (newline > safeOffset - 120) return newline + 1;
  if (sentence > safeOffset - 120) return sentence + 2;
  if (space > safeOffset - 80) return space + 1;
  return safeOffset;
}

// Binary-search the largest prefix that fits in textH using a hidden mirror element.
function measurePages(text, mirrorEl, textH) {
  if (!text) return [''];
  const pages = [];
  let remaining = text;

  while (remaining.length > 0) {
    mirrorEl.textContent = remaining;

    if (mirrorEl.scrollHeight <= textH) {
      pages.push(remaining);
      break;
    }

    let lo = 1;
    let hi = remaining.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      mirrorEl.textContent = remaining.slice(0, mid);
      if (mirrorEl.scrollHeight <= textH) lo = mid; else hi = mid - 1;
    }

    const split = pickSplitPoint(remaining, lo);
    pages.push(remaining.slice(0, split));
    remaining = remaining.slice(split);
  }

  return pages.length > 0 ? pages : [''];
}

const PagedEditor = forwardRef(function PagedEditor({ value, onChange, placeholder, parentBook, pageWidth = 550, pageHeight = 900 }, ref) {
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);

  const allEntities = useMemo(() => [
    ...characters.map(e => ({ ...e, _type: 'characters' })),
    ...locations.map(e  => ({ ...e, _type: 'locations'  })),
    ...things.map(e     => ({ ...e, _type: 'things'     })),
    // Skip timeline pseudo-lore (no real wiki page) and any nameless rows so
    // the @-mention picker doesn't show garbage entries.
    ...lore.filter(e => !e._isTimelineEvent && e.name).map(e => ({ ...e, _type: 'lore' })),
    ...factions.map(e   => ({ ...e, _type: 'factions'   })),
    ...creatures.map(e  => ({ ...e, _type: 'creatures'  })),
  ].filter(e => e.name), [characters, locations, things, lore, factions, creatures]);

  const padH = 72;
  const padW = 60;
  const textW = pageWidth - padW * 2;
  const textH = pageHeight - padH * 2;

  // Pages = the source of truth for what each page contains.
  // Initial render holds the entire document on page 0; the init effect re-paginates
  // once the mirror element has mounted and we can measure.
  const [pages, setPages] = useState(() => [normalizeValue(value)]);
  const [mention, setMention] = useState(null);
  const [menuCursor, setMenuCursor] = useState(0);
  const [menuStyle, setMenuStyle] = useState({});

  const pageRefs = useRef([]);
  const mirrorRef = useRef(null);
  const menuRef = useRef(null);
  const composingRef = useRef(false);
  const pagesRef = useRef(pages);
  const lastEmittedValueRef = useRef(value || '');
  const layoutKeyRef = useRef(`${textW}:${textH}`);
  const initializedRef = useRef(false);

  // Always keep ref synced so handlers see the latest pages without re-binding.
  pagesRef.current = pages;

  // Sync each page's DOM innerHTML to its source-of-truth text.
  // Runs after every render but is a no-op when the DOM already matches,
  // so during ordinary typing (where the active page DOM is already correct)
  // nothing is rewritten and the caret is left alone.
  useLayoutEffect(() => {
    pages.forEach((text, i) => {
      const el = pageRefs.current[i];
      if (!el) return;
      if (readDOM(el) !== text) {
        el.innerHTML = buildEditHTML(text);
      }
    });
  }, [pages]);

  // Initial pagination once mirror is in the DOM.
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const m = mirrorRef.current;
    if (!m) return;

    const initial = normalizeValue(value);
    const newPages = measurePages(initial, m, textH);

    setPages(newPages);
    pagesRef.current = newPages;

    const serialized = joinPages(newPages);
    lastEmittedValueRef.current = serialized;
    if (serialized !== value) onChange(serialized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value change (e.g. story switched, undo/redo from parent).
  // Skip if this update originated from us.
  useEffect(() => {
    if (!initializedRef.current) return;
    if (value === lastEmittedValueRef.current) return;

    const m = mirrorRef.current;
    if (!m) return;

    const next = normalizeValue(value);
    const newPages = measurePages(next, m, textH);

    setPages(newPages);
    pagesRef.current = newPages;
    lastEmittedValueRef.current = joinPages(newPages);
    setMention(null);
  }, [value]);

  // Layout (page width/height) change → re-paginate using the existing text.
  useEffect(() => {
    const newKey = `${textW}:${textH}`;
    if (newKey === layoutKeyRef.current) return;
    layoutKeyRef.current = newKey;
    if (!initializedRef.current) return;

    const m = mirrorRef.current;
    if (!m) return;

    const allText = pagesRef.current.join('');
    const newPages = measurePages(allText, m, textH);
    setPages(newPages);
    pagesRef.current = newPages;

    const serialized = joinPages(newPages);
    if (serialized !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = serialized;
      onChange(serialized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textW, textH]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getActivePageIndex = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return -1;
    const node = sel.getRangeAt(0).startContainer;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (el && (el === node || el.contains(node))) return i;
    }
    return -1;
  }, []);

  const getCaretRect = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    return range.getClientRects()[0] || null;
  };

  const updateMention = (pageIndex, localText, localCaret) => {
    if (pageIndex < 0) { setMention(null); return; }

    const before = localText.slice(0, localCaret);
    const atPos = before.lastIndexOf('@');
    if (atPos === -1) { setMention(null); return; }

    const queryWithAt = localText.slice(atPos, localCaret);
    if (/\s/.test(queryWithAt.slice(1))) { setMention(null); return; }

    const query = queryWithAt.slice(1);
    if (query.length > MENTION_LIMIT) { setMention(null); return; }

    const rect = getCaretRect();
    setMention({ pageIndex, atPos, caretPos: localCaret, query });
    setMenuCursor(0);

    if (rect) {
      setMenuStyle({
        top: Math.min(rect.bottom + 8, window.innerHeight - 280),
        left: Math.min(rect.left, window.innerWidth - 320),
      });
    }
  };

  const mentionSuggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return allEntities.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, allEntities]);

  // ── Core: re-paginate from a fully-built doc string + absolute caret ──────
  // Used by anything that mutates text outside the natural typing path
  // (Enter/Tab inserts, paste, mention insert, cross-page Backspace/Delete).
  const commitFullText = (fullText, absoluteCaret) => {
    const m = mirrorRef.current;
    const newPages = m ? measurePages(fullText, m, textH) : [fullText];

    let remaining = absoluteCaret;
    let caretPage = newPages.length - 1;
    let caretLocal = newPages[caretPage].length;
    for (let i = 0; i < newPages.length; i++) {
      if (remaining <= newPages[i].length) {
        caretPage = i;
        caretLocal = remaining;
        break;
      }
      remaining -= newPages[i].length;
    }

    pagesRef.current = newPages;
    setPages(newPages);

    requestAnimationFrame(() => {
      const el = pageRefs.current[caretPage];
      if (!el) return;
      el.focus();
      setCaretOffset(el, caretLocal);
    });

    const serialized = joinPages(newPages);
    lastEmittedValueRef.current = serialized;
    onChange(serialized);
  };

  // Returns the absolute caret offset across all pages for a position inside a given page el.
  const absoluteOffset = (pageIndex, localOffset) => {
    return pagesRef.current.slice(0, pageIndex).join('').length + localOffset;
  };

  // If there is a cross-page selection, collapse it by deleting the selected
  // range and return the resulting fullText + absoluteCaret, else return null.
  const collapseCrossPageSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const allPages = pageRefs.current.filter(Boolean);

    // Identify which page each boundary is in
    const findPage = (node) => {
      for (let i = 0; i < pageRefs.current.length; i++) {
        const el = pageRefs.current[i];
        if (el && (el === node || el.contains(node))) return i;
      }
      return -1;
    };

    const startPage = findPage(range.startContainer);
    const endPage   = findPage(range.endContainer);
    if (startPage === -1 || endPage === -1 || startPage === endPage) return null;

    // Measure absolute offsets
    const startLocal = getCaretOffset(pageRefs.current[startPage]);
    // Temporarily collapse to end to measure end offset
    const endEl = pageRefs.current[endPage];
    const savedRange = range.cloneRange();
    const endLocal = (() => {
      const r = document.createRange();
      r.setStart(endEl, 0);
      r.setEnd(range.endContainer, range.endOffset);
      const tmp = r.toString().length;
      return tmp;
    })();

    const absStart = absoluteOffset(startPage, startLocal);
    const absEnd   = absoluteOffset(endPage, endLocal);

    const fullText = pagesRef.current.join('');
    const newText  = fullText.slice(0, absStart) + fullText.slice(absEnd);

    sel.removeAllRanges();
    return { fullText: newText, caret: absStart };
  };

  // ── Core: handle natural typing in a specific page ─────────────────────────
  const handlePageInput = (pageIndex) => {
    if (composingRef.current) return;
    const activeEl = pageRefs.current[pageIndex];
    if (!activeEl) return;

    const localText = readDOM(activeEl);
    const localCaret = getCaretOffset(activeEl);

    const oldPages = pagesRef.current;
    const before = oldPages.slice(0, pageIndex).join('');
    const after = oldPages.slice(pageIndex + 1).join('');
    const fullText = before + localText + after;
    const absoluteCaret = before.length + localCaret;

    const m = mirrorRef.current;
    const newPages = m ? measurePages(fullText, m, textH) : [fullText];

    // Map absolute caret → (newPage, newLocalOffset)
    let remaining = absoluteCaret;
    let caretPage = 0;
    let caretLocal = absoluteCaret;
    for (let i = 0; i < newPages.length; i++) {
      if (remaining <= newPages[i].length) {
        caretPage = i;
        caretLocal = remaining;
        break;
      }
      remaining -= newPages[i].length;
    }

    const sameLength = oldPages.length === newPages.length;
    // The active page's text didn't reflow — the browser already has the
    // correct DOM and caret. We must NOT touch it.
    const activePageStable = sameLength && newPages[pageIndex] === localText;

    pagesRef.current = newPages;
    setPages(newPages);

    if (!activePageStable) {
      // A page boundary shifted. useLayoutEffect will rewrite changed pages'
      // innerHTML; we must restore the caret afterward.
      requestAnimationFrame(() => {
        const el = pageRefs.current[caretPage];
        if (!el) return;
        el.focus();
        setCaretOffset(el, caretLocal);
      });
    }

    const serialized = joinPages(newPages);
    lastEmittedValueRef.current = serialized;
    onChange(serialized);

    // Mention tracker: query lives in the page that the caret is currently in.
    const mentionPageText = (caretPage === pageIndex && activePageStable)
      ? localText
      : newPages[caretPage];
    updateMention(caretPage, mentionPageText, caretLocal);
  };

  // Insert arbitrary text at current caret location, then commit.
  const insertTextAtActivePage = (insertedText) => {
    const pageIndex = getActivePageIndex();
    if (pageIndex === -1) return;
    const el = pageRefs.current[pageIndex];
    if (!el) return;

    const localText = readDOM(el);
    const localCaret = getCaretOffset(el);

    const before = pagesRef.current.slice(0, pageIndex).join('');
    const after = pagesRef.current.slice(pageIndex + 1).join('');
    const newLocalText = localText.slice(0, localCaret) + insertedText + localText.slice(localCaret);
    const fullText = before + newLocalText + after;
    const absoluteCaret = before.length + localCaret + insertedText.length;

    commitFullText(fullText, absoluteCaret);
  };

  useImperativeHandle(ref, () => ({
    insertSceneBreak: () => { insertTextAtActivePage('\n\n* * *\n\n'); },
  }), [insertTextAtActivePage]);

  const insertMention = (entity) => {
    if (!mention) return;
    const { pageIndex, atPos, caretPos } = mention;
    const el = pageRefs.current[pageIndex];
    if (!el) return;

    const localText = readDOM(el);
    const before = pagesRef.current.slice(0, pageIndex).join('');
    const after = pagesRef.current.slice(pageIndex + 1).join('');
    const newLocalText = localText.slice(0, atPos) + entity.name + localText.slice(caretPos);
    const fullText = before + newLocalText + after;
    const absoluteCaret = before.length + atPos + entity.name.length;

    setMention(null);
    commitFullText(fullText, absoluteCaret);
  };

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleBeforeInput = (e) => {
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
      e.preventDefault();
      const collapsed = collapseCrossPageSelection();
      if (collapsed) {
        commitFullText(collapsed.fullText + '\n', collapsed.caret + 1);
      } else {
        insertTextAtActivePage('\n');
      }
      return;
    }

    // Typed character over a cross-page selection: delete selection then insert
    if (e.inputType === 'insertText' && e.data) {
      const collapsed = collapseCrossPageSelection();
      if (collapsed) {
        e.preventDefault();
        commitFullText(collapsed.fullText.slice(0, collapsed.caret) + e.data + collapsed.fullText.slice(collapsed.caret), collapsed.caret + e.data.length);
      }
    }
  };

  const handleKeyDown = (e, pageIndex) => {
    // Mention dropdown navigation
    if (mention && mentionSuggestions.length > 0) {
      const selectedIndex = Math.min(menuCursor, mentionSuggestions.length - 1);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuCursor(c => Math.min(c + 1, mentionSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuCursor(c => Math.max(c - 1, 0));
        return;
      }
      if (e.key === 'Escape') { setMention(null); return; }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionSuggestions[selectedIndex]);
        return;
      }
    }

    // ⌘A / Ctrl+A → select all text across all pages
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      const allPages = pageRefs.current.filter(Boolean);
      if (allPages.length === 0) return;
      const first = allPages[0];
      const last  = allPages[allPages.length - 1];
      const range = document.createRange();
      range.setStart(first, 0);
      range.setEnd(last, last.childNodes.length);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }


    const el = pageRefs.current[pageIndex];
    if (!el) return;

    const localText = readDOM(el);
    const caret = getCaretOffset(el);
    const sel = window.getSelection();
    const collapsed = !sel || sel.isCollapsed;

    // Backspace/Delete with cross-page selection → delete selected range
    if ((e.key === 'Backspace' || e.key === 'Delete') && !collapsed) {
      const cross = collapseCrossPageSelection();
      if (cross) {
        e.preventDefault();
        commitFullText(cross.fullText, cross.caret);
        return;
      }
    }

    // Backspace at start of a non-first page → delete last char of previous page
    if (e.key === 'Backspace' && collapsed && caret === 0 && pageIndex > 0) {
      e.preventDefault();
      const before = pagesRef.current.slice(0, pageIndex - 1).join('');
      const prevText = pagesRef.current[pageIndex - 1] || '';
      const newPrev = prevText.slice(0, -1);
      const after = pagesRef.current.slice(pageIndex + 1).join('');
      const fullText = before + newPrev + localText + after;
      const absoluteCaret = before.length + newPrev.length;
      commitFullText(fullText, absoluteCaret);
      return;
    }

    // Delete at end of a non-last page → delete first char of next page
    if (e.key === 'Delete' && collapsed && caret === localText.length && pageIndex < pagesRef.current.length - 1) {
      e.preventDefault();
      const before = pagesRef.current.slice(0, pageIndex).join('');
      const nextText = pagesRef.current[pageIndex + 1] || '';
      const newNext = nextText.slice(1);
      const after = pagesRef.current.slice(pageIndex + 2).join('');
      const fullText = before + localText + newNext + after;
      const absoluteCaret = before.length + localText.length;
      commitFullText(fullText, absoluteCaret);
      return;
    }

    // ArrowLeft at start → jump to end of previous page
    if (e.key === 'ArrowLeft' && collapsed && caret === 0 && pageIndex > 0) {
      e.preventDefault();
      const prevEl = pageRefs.current[pageIndex - 1];
      if (prevEl) {
        const prevLen = (pagesRef.current[pageIndex - 1] || '').length;
        prevEl.focus();
        setCaretOffset(prevEl, prevLen);
      }
      return;
    }

    // ArrowRight at end → jump to start of next page
    if (e.key === 'ArrowRight' && collapsed && caret === localText.length && pageIndex < pagesRef.current.length - 1) {
      e.preventDefault();
      const nextEl = pageRefs.current[pageIndex + 1];
      if (nextEl) {
        nextEl.focus();
        setCaretOffset(nextEl, 0);
      }
      return;
    }
  };

  const handlePaste = (e, pageIndex) => {
    e.preventDefault();
    const el = pageRefs.current[pageIndex];
    if (!el) return;

    const pasted = e.clipboardData.getData('text/plain');
    const localText = readDOM(el);
    const localCaret = getCaretOffset(el);

    const before = pagesRef.current.slice(0, pageIndex).join('');
    const after = pagesRef.current.slice(pageIndex + 1).join('');
    const newLocalText = localText.slice(0, localCaret) + pasted + localText.slice(localCaret);
    const fullText = before + newLocalText + after;
    const absoluteCaret = before.length + localCaret + pasted.length;

    commitFullText(fullText, absoluteCaret);
  };

  // Dismiss mention menu on outside click
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMention(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const totalText = pages.join('');
  const showPlaceholder = !totalText.trim();

  return (
    <div className="relative flex flex-col items-center">
      {/* Hidden mirror element used to measure how much text fits per page. */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        style={{
          position: 'fixed', top: '-9999px', left: '-9999px',
          width: `${textW}px`,
          fontSize: `${FONT_SIZE}px`, lineHeight: String(LINE_HEIGHT),
          fontFamily: 'var(--font-story, Georgia, "Times New Roman", serif)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          overflowY: 'visible', height: 'auto',
          padding: '0', boxSizing: 'border-box',
        }}
      />

      {/* One book-page per logical page, with a clean 1rem gap between them
          (matching the preview). Each page has its own contenteditable so we
          never have to fake page padding/breaks inside a single editor. */}
      <div className="w-full flex flex-col items-center gap-4">
        {pages.map((_, pageIndex) => (
          <div
            key={pageIndex}
            className="book-page-dark relative"
            style={{
              width: pageWidth,
              minHeight: pageHeight,
              padding: `${padH}px ${padW}px`,
              overflow: 'hidden',
            }}
          >
            {pageIndex === 0 && showPlaceholder && (
              <p
                className="absolute pointer-events-none font-story select-none"
                style={{
                  top: padH, left: padW, right: padW,
                  fontSize: `${FONT_SIZE}px`, lineHeight: String(LINE_HEIGHT),
                  color: 'rgba(255,255,255,0.2)',
                }}
              >
                {placeholder}
              </p>
            )}

            <div
              ref={(el) => { pageRefs.current[pageIndex] = el; }}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              data-page-index={pageIndex}
              onBeforeInput={handleBeforeInput}
              onInput={() => handlePageInput(pageIndex)}
              onKeyDown={(e) => handleKeyDown(e, pageIndex)}
              onPaste={(e) => handlePaste(e, pageIndex)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; handlePageInput(pageIndex); }}
              className="w-full bg-transparent border-none focus:outline-none font-story prose-page"
              style={{
                color: 'inherit',
                fontSize: `${FONT_SIZE}px`,
                lineHeight: String(LINE_HEIGHT),
                minHeight: `${textH}px`,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                caretColor: 'white',
                outline: 'none',
                position: 'relative',
                zIndex: 1,
                tabSize: 4,
                MozTabSize: 4,
              }}
            />

            <div
              aria-hidden="true"
              className="absolute pointer-events-none select-none"
              style={{
                left: padW, right: padW,
                bottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.6rem',
                letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.18)',
              }}
            >
              <span>{parentBook?.name || 'Realm Lore'}</span>
              <span>{pageIndex + 1} / {pages.length}</span>
            </div>
          </div>
        ))}
      </div>

      {/* @ Mention dropdown */}
      {mention && mentionSuggestions.length > 0 && (
        <div
          ref={menuRef}
          style={{ ...menuStyle, position: 'fixed' }}
          className="z-50 w-72 bg-popover border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden"
        >
          <p className="px-3 pb-1 text-xs text-muted-foreground font-medium">
            {mention.query ? `Matching "${mention.query}"` : 'All entities'} - Tab/Enter to insert
          </p>
          {mentionSuggestions.map((e, i) => {
            const meta = TYPE_META[e._type];
            const Icon = meta.icon;
            return (
              <button
                key={e.id}
                onMouseDown={(ev) => { ev.preventDefault(); insertMention(e); }}
                onMouseEnter={() => setMenuCursor(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === menuCursor ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
              >
                <span className={`shrink-0 p-1.5 rounded-md border ${meta.bg} ${meta.border}`}>
                  <Icon size={12} className={meta.color} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {e._type.slice(0, -1)}{e.type ? ` · ${e.type}` : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default PagedEditor;
