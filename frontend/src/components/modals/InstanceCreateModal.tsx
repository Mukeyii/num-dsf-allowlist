import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { api } from '../../api/entities.api';
import { useCanvasStore } from '../../stores/canvas.store';

interface Props { open: boolean; onClose: () => void; }

export function InstanceCreateModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const setActiveInstance = useCanvasStore((s) => s.setActiveInstance);
  const qc = useQueryClient();

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await api('_').createInstance({ label: '' });
      const newInstance = res.data.data;
      await qc.invalidateQueries({ queryKey: ['instances'] });
      setActiveInstance(newInstance.id);
      toast.success('Instance created. It shows as UUID until you assign an Organization.', { duration: 6000 });
      onClose();
    } catch { toast.error('Failed to create instance.'); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Instance" width="max-w-sm">
      <div className="space-y-4">
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs text-indigo-700 leading-relaxed">
            A new instance will be created and listed with a UUID. After creation, assign all mandatory information:
          </p>
          <ol className="mt-2 space-y-1 text-xs text-indigo-600 list-decimal list-inside">
            <li>Set up Organization (identifier + name)</li>
            <li>Add at least one Endpoint</li>
            <li>Add at least one Certificate</li>
            <li>Add at least one Contact</li>
            <li>Send for Approval</li>
          </ol>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={loading}
            className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #4d41df, #675df9)' }}>
            {loading ? 'Creating…' : 'Create Instance'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
