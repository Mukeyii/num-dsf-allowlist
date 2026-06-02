/**
 * CertificateModal.tsx — modal to add a certificate by pasting or drag-dropping a PEM file.
 * Validates via certificateSchema (rejects private keys) and submits through the cross-user guard.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, ModalFooter } from './FormField';
import { certificateSchema, CertificateFormData } from '../../schemas/certificate.schema';
import { useCreateCertificate } from '../../hooks/useCertificates';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';

interface Props { open: boolean; onClose: () => void; instanceId: string; }

export function CertificateModal({ open, onClose, instanceId }: Props) {
  const { t } = useI18n();
  const { mutateAsync, isPending } = useCreateCertificate(instanceId);
  const guard = useCrossUserGuard();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CertificateFormData>({ resolver: zodResolver(certificateSchema) });
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setValue('pem', text);
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    if (open) reset({ pem: '' });
  }, [open, reset]);

  async function onSubmit(data: CertificateFormData) {
    try {
      await new Promise<void>((resolve, reject) => {
        guard(async () => {
          try { await mutateAsync(data.pem); resolve(); } catch (e) { reject(e); }
        });
      });
      toast.success(t('certModalSaveSuccess'));
      onClose();
      reset();
    } catch (err: any) {
      const msg = getErrorMessage(err, t('certModalSaveFailed'));
      if (msg.includes('PRIVATE_KEY')) {
        toast.error(t('certModalPrivateKeyDetected'));
      } else { toast.error(msg); }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('certModalTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">warning</span>
            <div>
              <p className="text-xs font-bold text-red-700 mb-1">{t('certModalPrivateKeyWarningTitle')}</p>
              <p className="text-[10px] text-red-600">{t('certModalPrivateKeyWarningBody')}</p>
            </div>
          </div>
        </div>
        <FormField label={t('certModalFieldPem')} required error={errors.pem?.message} hint={t('certModalFieldPemHint')}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? '#6c63ff' : '#e8eaf0'}`,
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center',
              transition: 'border-color 0.2s',
              background: dragOver ? '#ede9ff' : 'transparent',
              marginBottom: '8px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: dragOver ? '#6c63ff' : '#d4d8e8', display: 'block', marginBottom: '4px' }}>upload_file</span>
            <p style={{ fontSize: '11px', color: '#9b9fad' }}>
              {t('certModalDropHint')}
            </p>
          </div>
          <textarea {...register('pem')} rows={10}
            className="w-full px-3 py-2 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-300 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
            placeholder={`-----BEGIN CERTIFICATE-----\nMIIHEzCC8PugAwIBAqIRALuIH+...\n...\n-----END CERTIFICATE-----`} />
        </FormField>
        <ModalFooter onCancel={onClose} loading={isPending} submitLabel={t('certModalSaveBtn')} />
      </form>
    </Modal>
  );
}
