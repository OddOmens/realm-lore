import JSZip from 'jszip';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Strip wiki chips `[[Name]]` → plain Name for export */
export function mentionsToPlain(text) {
  return String(text || '').replace(/\[\[([^\]]+)\]\]/g, '$1');
}

export function stripStoryToParagraphs(content) {
  const raw = String(content || '').replace(/\f/g, '\n\n');
  const lines = raw.split(/\n+/);
  const paras = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    paras.push(t);
  }
  return paras;
}

export function compileHtmlManuscript(book, chaptersInOrder) {
  const title = escapeXml(book?.name || 'Untitled');
  const subtitle = book?.subtitle ? `<p class="subtitle"><em>${escapeXml(book.subtitle)}</em></p>` : '';
  const author = book?.author ? `<p class="author">${escapeXml(book.author)}</p>` : '';

  let body = '';
  for (const ch of chaptersInOrder) {
    body += `<section class="chapter"><h1>${escapeXml(ch.name || 'Untitled chapter')}</h1>`;
    for (const p of stripStoryToParagraphs(ch.content || '')) {
      const plain = mentionsToPlain(p);
      if (plain === '* * *' || plain === '***') {
        body += '<p class="scene-break">* * *</p>';
      } else {
        body += `<p>${escapeXml(plain)}</p>`;
      }
    }
    body += '</section>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 36rem; margin: 2.5rem auto; line-height: 1.65; color: #1a1a1a; }
    h1 { font-size: 1.75rem; margin: 2rem 0 0.75rem; }
    .subtitle { font-size: 1rem; margin: 0 0 0.5rem; }
    .author { font-size: 0.95rem; color: #555; margin: 0 0 2rem; }
    .chapter h1 { font-size: 1.35rem; border-bottom: 1px solid #ddd; padding-bottom: 0.35rem; }
    p { margin: 0 0 0.85rem; text-indent: 1.25em; }
    p.scene-break { text-align: center; text-indent: 0; letter-spacing: 0.35em; margin: 2rem 0; color: #888; }
    @media print { body { margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    ${subtitle}
    ${author}
  </header>
  ${body}
</body>
</html>`;
}

export function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal EPUB 3 (works in Apple Books, Calibre, many readers). */
export async function buildEpubBlob(book, chaptersInOrder) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  const metaDir = zip.folder('META-INF');
  metaDir.file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const oebps = zip.folder('OEBPS');
  const chapterFiles = [];

  chaptersInOrder.forEach((ch, i) => {
    const fname = `chapter${i + 1}.xhtml`;
    chapterFiles.push(fname);
    let inner = '';
    for (const p of stripStoryToParagraphs(ch.content || '')) {
      const plain = mentionsToPlain(p);
      if (plain === '* * *' || plain === '***') {
        inner += '<p class="scene">* * *</p>';
      } else {
        inner += `<p>${escapeXml(plain)}</p>`;
      }
    }
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
  <title>${escapeXml(ch.name || 'Chapter')}</title>
  <style>
    body { font-family: serif; line-height: 1.5; margin: 1em; }
    h1 { font-size: 1.2em; }
    p { margin: 0 0 0.8em; text-indent: 1.2em; }
    p.scene { text-align: center; text-indent: 0; letter-spacing: 0.25em; }
  </style>
</head>
<body>
  <h1>${escapeXml(ch.name || 'Chapter')}</h1>
  ${inner}
</body>
</html>`;
    oebps.file(fname, xhtml);
  });

  const navItems = chaptersInOrder.map((ch, i) =>
    `<li><a href="chapter${i + 1}.xhtml">${escapeXml(ch.name || `Chapter ${i + 1}`)}</a></li>`
  ).join('\n');

  oebps.file('nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><title>Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>${navItems}</ol>
  </nav>
</body>
</html>`);

  const uuid = `urn:uuid:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`;
  const title = escapeXml(book?.name || 'Book');
  const author = escapeXml(book?.author || 'Unknown');

  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    ...chapterFiles.map((f, i) => `<item id="ch${i + 1}" href="${f}" media-type="application/xhtml+xml"/>`),
  ].join('\n    ');

  const spineItems = chapterFiles.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('\n    ');

  oebps.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">${uuid}</dc:identifier>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  return blob;
}
