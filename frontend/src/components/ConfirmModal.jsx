import Modal from './Modal';

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="text-sm text-muted-foreground mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="h-9 px-4 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
