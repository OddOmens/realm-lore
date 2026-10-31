import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { svgToDataUri } from './stamps';

// ── Custom stamp upload modal ─────────────────────────────────────────────────
// Presented after the user picks an SVG file. We've already sanitized + read
// the file; the modal collects a friendly name and tags, then commits.
export default function CustomStampUploadModal({ initialName, svg, onSave, onClose }) {
  const [name, setName] = useState(initialName || '');
  const [tagsRaw, setTagsRaw] = useState('');
  const [error, setError] = useState('');

  const tags = useMemo(
    () => tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
    [tagsRaw]
  );

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) { setError('Give your stamp a name.'); return; }
    if (!svg) { setError('SVG content is empty.'); return; }
    await onSave({ name: cleanName, tags, svg });
  };

  return (
    <Modal title="Add custom stamp" onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-center bg-surface border border-border rounded-lg p-6 min-h-32">
          <img
            src={svgToDataUri(svg)}
            alt="Stamp preview"
            style={{ maxWidth: 96, maxHeight: 96, display: 'block' }}
            draggable={false}
          />
        </div>
        <div>
          <label className="block section-label mb-1.5">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Black tower"
            className="input"
          />
        </div>
        <div>
          <label className="block section-label mb-1.5">Tags</label>
          <input
            value={tagsRaw}
            onChange={e => setTagsRaw(e.target.value)}
            placeholder="comma, separated, tags"
            className="input"
          />
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span key={t} className="badge">{t}</span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">Tags help filter the stamp picker. Try things like “fortification”, “ruin”, “forest”.</p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="btn btn-outline"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
          >
            Save stamp
          </button>
        </div>
      </div>
    </Modal>
  );
}
