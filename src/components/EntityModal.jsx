import { useState } from 'react';
import Modal from './Modal';

const FIELDS = {
  characters: [
    { key: 'name', label: 'Name', placeholder: 'e.g. Aldric the Grey', required: true },
    { key: 'description', label: 'Description', placeholder: 'A brief description...', multiline: true },
  ],
  locations: [
    { key: 'name', label: 'Name', placeholder: 'e.g. The Sunken City', required: true },
    { key: 'description', label: 'Description', placeholder: 'A brief description...', multiline: true },
  ],
  things: [
    { key: 'name', label: 'Name', placeholder: 'e.g. Shadowblade', required: true },
    { key: 'type', label: 'Type', placeholder: 'e.g. Item, Artifact, Monster' },
    { key: 'description', label: 'Description', placeholder: 'A brief description...', multiline: true },
  ],
  stories: [
    { key: 'name', label: 'Title', placeholder: 'e.g. The First War', required: true },
  ],
};

export default function EntityModal({ entityType, initial = {}, onSave, onClose }) {
  const fields = FIELDS[entityType] || [];
  const [values, setValues] = useState(() => {
    const defaults = {};
    fields.forEach(f => { defaults[f.key] = initial[f.key] ?? ''; });
    return defaults;
  });

  const title = initial.id
    ? `Edit ${entityType.slice(0, -1).replace(/^\w/, c => c.toUpperCase())}`
    : `New ${entityType.slice(0, -1).replace(/^\w/, c => c.toUpperCase())}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    const required = fields.find(f => f.required && !values[f.key]?.trim());
    if (required) return;
    onSave(values);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
            {field.multiline ? (
              <textarea
                autoFocus={fields[0].key === field.key}
                value={values[field.key]}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={4}
                className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground"
              />
            ) : (
              <input
                autoFocus={fields[0].key === field.key}
                type="text"
                value={values[field.key]}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            )}
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {initial.id ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
