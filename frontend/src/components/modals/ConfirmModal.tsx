import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
}

export function ConfirmModal({ open, onClose, onConfirm, loading, title = 'Are you sure?', message = 'This action cannot be undone.' }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-sm text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
