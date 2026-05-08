/**
 * Lightweight plain-text preview for entity cards.
 *
 * Unlike RichTextPreview this component subscribes to ZERO store slices and
 * compiles ZERO regexes — it simply strips [[wikilinks]] and markdown-style
 * formatting so the card grid renders instantly without blocking the main
 * thread.
 */
export default function PlainTextPreview({ text }) {
  if (!text) return null;
  const plain = text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')   // [[Entity]] → Entity
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')           // *italic* → italic
    .replace(/\f/g, ' ')                   // page separators
    .replace(/\n+/g, ' ')                  // newlines → spaces
    .trim()
    .slice(0, 200);                        // cap length for perf
  return <>{plain}</>;
}
