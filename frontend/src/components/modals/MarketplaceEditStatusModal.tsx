/**
 * MarketplaceEditStatusModal.tsx – Modal for editing a marketplace entry's status
 * Dependencies: Modal, FormField, useUpdateMarketplaceStatus, marketplace.schema, i18n.store, sonner
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, selectClass, inputClass, ModalFooter } from './FormField';
import { marketplaceEditFormSchema, MarketplaceEditForm } from '../../schemas/marketplace.schema';
import { useUpdateMarketplaceStatus } from '../../hooks/useMarketplace';
import { useI18n } from '../../stores/i18n.store';

interface Props {
  open: boolean;
  onClose: () => void;
  entryId: string;
  currentStatus: 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';
}

export function MarketplaceEditStatusModal({ open, onClose, entryId, currentStatus }: Props) {
  const { t } = useI18n();
  const updateMut = useUpdateMarketplaceStatus();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarketplaceEditForm>({
    resolver: zodResolver(marketplaceEditFormSchema),
    defaultValues: { status: currentStatus, totpCode: '' },
  });

  useEffect(() => {
    if (open) reset({ status: currentStatus, totpCode: '' });
  }, [open, currentStatus, reset]);

  async function onSubmit(data: MarketplaceEditForm) {
    try {
      await updateMut.mutateAsync({ id: entryId, body: data });
      toast.success(t('marketplaceEdit'));
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Failed');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('marketplaceEdit')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label={t('marketplaceFieldStatus')} required error={errors.status?.message}>
          <select {...register('status')} className={selectClass}>
            <option value="APPROVED">{t('marketplaceStatusApproved')}</option>
            <option value="EXPERIMENTAL">{t('marketplaceStatusExperimental')}</option>
            <option value="DEPRECATED">{t('marketplaceStatusDeprecated')}</option>
          </select>
        </FormField>

        <FormField label="TOTP Code" required error={errors.totpCode && '6 digits required'}>
          <input
            {...register('totpCode')}
            className={inputClass}
            maxLength={6}
            inputMode="numeric"
            placeholder="000000"
            style={{ fontFamily: 'monospace', letterSpacing: '4px', textAlign: 'center' }}
          />
        </FormField>

        <ModalFooter onCancel={onClose} loading={updateMut.isPending} submitLabel={t('marketplaceEdit')} />
      </form>
    </Modal>
  );
}
