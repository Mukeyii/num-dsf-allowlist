import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, ModalFooter } from './FormField';
import { certificateSchema, CertificateFormData } from '../../schemas/certificate.schema';
import { useCreateCertificate } from '../../hooks/useCertificates';

interface Props { open: boolean; onClose: () => void; instanceId: string; }

export function CertificateModal({ open, onClose, instanceId }: Props) {
  const { mutateAsync, isPending } = useCreateCertificate(instanceId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CertificateFormData>({ resolver: zodResolver(certificateSchema) });

  useEffect(() => {
    if (open) reset({ pem: '' });
  }, [open, reset]);

  async function onSubmit(data: CertificateFormData) {
    try {
      await mutateAsync(data.pem);
      toast.success('Certificate added and parsed successfully.');
      onClose();
      reset();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to add certificate.';
      if (msg.includes('PRIVATE_KEY')) {
        toast.error('Private key detected. Remove the private key and paste only the certificate.');
      } else { toast.error(msg); }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Certificate">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">warning</span>
            <div>
              <p className="text-xs font-bold text-red-700 mb-1">Do not insert private key information</p>
              <p className="text-[10px] text-red-600">Paste only the public certificate PEM block. Never include your private key.</p>
            </div>
          </div>
        </div>
        <FormField label="Certificate PEM" required error={errors.pem?.message} hint="Paste the PEM block starting with -----BEGIN CERTIFICATE-----">
          <textarea {...register('pem')} rows={10}
            className="w-full px-3 py-2 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-300 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
            placeholder={`-----BEGIN CERTIFICATE-----\nMIIHEzCC8PugAwIBAqIRALuIH+...\n...\n-----END CERTIFICATE-----`} />
        </FormField>
        <ModalFooter onCancel={onClose} loading={isPending} submitLabel="Save & Parse" />
      </form>
    </Modal>
  );
}
