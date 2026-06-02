/**
 * InstanceCreateModal.tsx — modal that creates a new DSF instance and selects it as active.
 * Shows onboarding steps; invalidates the instances query and updates the canvas store on success.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { api } from '../../api/entities.api';
import { useCanvasStore } from '../../stores/canvas.store';
import { useI18n } from '../../stores/i18n.store';

interface Props { open: boolean; onClose: () => void; }

export function InstanceCreateModal({ open, onClose }: Props) {
  const { t } = useI18n();
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
      toast.success(t('instanceCreateSuccess'), { duration: 6000 });
      onClose();
    } catch { toast.error(t('instanceCreateFailed')); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('instanceCreateTitle')} width="max-w-sm">
      <div className="space-y-4">
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs text-indigo-700 leading-relaxed">
            {t('instanceCreateInfo')}
          </p>
          <ol className="mt-2 space-y-1 text-xs text-indigo-600 list-decimal list-inside">
            <li>{t('instanceCreateStep1')}</li>
            <li>{t('instanceCreateStep2')}</li>
            <li>{t('instanceCreateStep3')}</li>
            <li>{t('instanceCreateStep4')}</li>
            <li>{t('instanceCreateStep5')}</li>
          </ol>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">{t('instanceCreateCancelBtn')}</button>
          <button onClick={handleCreate} disabled={loading}
            className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #4d41df, #675df9)' }}>
            {loading ? t('instanceCreatingBtn') : t('instanceCreateBtn')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
