/**
 * MarketplaceAddModal.tsx – Modal for adding a new marketplace process entry
 * Dependencies: Modal, FormField, useAddMarketplace, marketplace.schema, i18n.store, sonner
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, inputClass, selectClass, ModalFooter } from './FormField';
import { marketplaceAddFormSchema, MarketplaceAddForm } from '../../schemas/marketplace.schema';
import { useAddMarketplace } from '../../hooks/useMarketplace';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MarketplaceAddModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const addMut = useAddMarketplace();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarketplaceAddForm>({
    resolver: zodResolver(marketplaceAddFormSchema),
    defaultValues: { gitUrl: '', status: 'APPROVED', totpCode: '' },
  });

  useEffect(() => {
    if (open) reset({ gitUrl: '', status: 'APPROVED', totpCode: '' });
  }, [open, reset]);

  async function onSubmit(data: MarketplaceAddForm) {
    try {
      await addMut.mutateAsync(data);
      toast.success(t('marketplaceAdd'));
      onClose();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed');
      toast.error(msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('marketplaceAdd')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('marketplaceFieldGitUrl')}
          required
          error={errors.gitUrl && t('marketplaceInvalidUrl')}
        >
          <input
            {...register('gitUrl')}
            className={inputClass}
            placeholder="https://github.com/owner/repo"
          />
        </FormField>

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

        <ModalFooter
          onCancel={onClose}
          loading={addMut.isPending}
          submitLabel={t('marketplaceAdd')}
        />
      </form>
    </Modal>
  );
}
