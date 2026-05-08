
// Shared helpers for contenteditable editors and view renderers

// In the editor we render every paragraph as its own <p> block (so each one
// can get a first-line indent like a printed book). A <br> that's the only
// child of a <p> is purely a visual filler so the empty paragraph still has
// height; it does NOT correspond to a real \n in the source text.
function isParagraphFillerBR(node) {
  if (!node || node.nodeName !== 'BR') return false;
  const parent = node.parentNode;
  if (!parent || parent.nodeName !== 'P') return false;
  // Only-child BR, or last-child BR (browsers sometimes leave a trailing one).
  if (parent.childNodes.length === 1) return true;
  return parent.lastChild === node;
}

export function serializeNode(node) {
  if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.pageBreak) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeName === 'BR') return isParagraphFillerBR(node) ? '' : '\n';
  if (node.nodeName === 'SPAN' && node.dataset.entity) return node.dataset.entity;
  let out = '';
  for (const child of node.childNodes) out += serializeNode(child);
  if (node.nodeName === 'P') out += '\n';
  else if (node.nodeName === 'DIV' && ![...node.childNodes].some(c => c.nodeName === 'P')) out += '\n';
  return out;
}

// Walk the DOM counting chars the same way serializeNode does.
// range.toString() skips <br> nodes so we can't use it — we walk manually.
export function getCaretOffset(container) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const endNode = sel.getRangeAt(0).endContainer;
  const endOff  = sel.getRangeAt(0).endOffset;

  let count = 0;
  function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.pageBreak) return false;
    if (node === endNode) {
      if (node.nodeType === Node.TEXT_NODE) count += endOff;
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      count += node.textContent.length;
      return false;
    }
    if (node.nodeName === 'BR') {
      if (!isParagraphFillerBR(node)) count += 1;
      return false;
    }
    if (node.nodeName === 'SPAN' && node.dataset?.entity) {
      count += node.dataset.entity.length;
      return false;
    }
    for (const child of node.childNodes) {
      if (walk(child)) return true;
    }
    if (node !== container && (node.nodeName === 'DIV' || node.nodeName === 'P')) count += 1;
    return false;
  }
  walk(container);
  return count;
}

export function setCaretOffset(container, offset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let remaining = offset;
  let node = walker.nextNode();
  let blockSeen = false; // tracks whether we've entered any <p>/<div> block yet
  while (node) {
    const isElement = node.nodeType === Node.ELEMENT_NODE;

    // Block boundary: each <p>/<div> after the first contributes one implicit \n
    // to the source text (the paragraph separator).
    if (isElement && (node.nodeName === 'P' || node.nodeName === 'DIV')) {
      if (blockSeen) {
        if (remaining === 0) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(node, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        remaining -= 1;
      }
      blockSeen = true;
      node = walker.nextNode();
      continue;
    }

    const isEntitySpan = isElement && node.dataset?.entity;
    if (isEntitySpan) {
      const len = node.dataset.entity.length;
      if (remaining <= len) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else if (node.nodeType === Node.TEXT_NODE) {
      if (remaining <= node.textContent.length) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= node.textContent.length;
    } else if (node.nodeName === 'BR') {
      const filler = isParagraphFillerBR(node);
      if (remaining === 0) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStartBefore(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      if (!filler) remaining -= 1;
    }
    node = walker.nextNode();
  }
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(container);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function stripBrackets(text) {
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1');
}

export const TYPE_CHIP = {
  characters: 'bg-blue-500/15 border-blue-500/40 text-blue-300',
  locations:  'bg-green-500/15 border-green-500/40 text-green-300',
  things:     'bg-amber-500/15 border-amber-500/40 text-amber-300',
  lore:       'bg-purple-500/15 border-purple-500/40 text-purple-300',
  factions:   'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
  creatures:  'bg-orange-500/15 border-orange-500/40 text-orange-300',
};

function escapeHTML(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Edit mode: plain contenteditable, no chips ────────────────────────────────
// Each line of source text becomes its own <p> block so the editor can give
// every paragraph a first-line indent (book-style). Empty lines render as
// `<p><br></p>` purely so the empty paragraph keeps its height; the <br> is
// treated as a filler by the serializer/caret helpers above.
export function buildEditHTML(text) {
  if (text == null || text === '') return '<p><br></p>';
  return text
    .split('\n')
    .map(line => (line === '' ? '<p><br></p>' : `<p>${escapeHTML(line)}</p>`))
    .join('');
}

// ── View mode: parse text into segments with suffix-aware entity matching ─────
// Regex cache to avoid recompiling massive entity regexes on every render
let lastNamesKey = '';
let cachedPlainRegex = null;

export function parseSegments(text, entityByName) {
  if (!text) return [];

  const names = [...entityByName.keys()].sort((a, b) => b.length - a.length);
  const namesKey = names.join('|');

  if (namesKey !== lastNamesKey) {
    lastNamesKey = namesKey;
    cachedPlainRegex = names.length > 0
      ? new RegExp(`\\b(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})((?:'s|es|s)?)(?=\\W|$)`, 'gi')
      : null;
  }
  const plainRegex = cachedPlainRegex;

  const tokenRegex = /\[\[([^\]]+)\]\]/g;

  // Pass 1: [[Token]] splits
  const rawSegs = [];
  let last = 0, m;
  tokenRegex.lastIndex = 0;
  while ((m = tokenRegex.exec(text)) !== null) {
    if (m.index > last) rawSegs.push({ type: 'text', value: text.slice(last, m.index) });
    const hit = entityByName.get(m[1].toLowerCase());
    if (hit) rawSegs.push({ type: 'entity', name: m[1], suffix: '', meta: hit });
    else rawSegs.push({ type: 'text', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) rawSegs.push({ type: 'text', value: text.slice(last) });

  if (!plainRegex) return rawSegs;

  // Pass 2: within text segments, match entity names at word boundaries only
  const segs = [];
  for (const seg of rawSegs) {
    if (seg.type !== 'text') { segs.push(seg); continue; }
    let str = seg.value;
    plainRegex.lastIndex = 0;
    let match;
    let strLast = 0;
    while ((match = plainRegex.exec(str)) !== null) {
      const [full, name, suffix] = match;
      const hit = entityByName.get(name.toLowerCase());
      if (!hit) continue;
      if (match.index > strLast) segs.push({ type: 'text', value: str.slice(strLast, match.index) });
      segs.push({ type: 'entity', name, suffix, meta: hit });
      strLast = match.index + full.length;
    }
    if (strLast < str.length) segs.push({ type: 'text', value: str.slice(strLast) });
  }
  return segs;
}
