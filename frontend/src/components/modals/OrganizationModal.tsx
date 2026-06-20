/**
 * OrganizationModal.tsx — edit modal for the organization record (identity, address, cert thumbprint).
 * React Hook Form + organizationSchema; thumbprint changes require a TOTP code, saved via the cross-user guard.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, inputClass, ModalFooter } from './FormField';
import { organizationSchema, OrganizationFormData } from '../../schemas/organization.schema';
import { useUpdateOrganization } from '../../hooks/useOrganization';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  defaultValues?: Partial<OrganizationFormData>;
}

export function OrganizationModal({ open, onClose, instanceId, defaultValues }: Props) {
  const { t } = useI18n();
  const { mutateAsync, isPending } = useUpdateOrganization(instanceId);
  const guard = useCrossUserGuard();
  const [totpCode, setTotpCode] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { active: true, ...defaultValues },
  });

  useEffect(() => {
    if (open && defaultValues) {
      reset({ active: true, ...defaultValues });
      setTotpCode('');
    }
  }, [open, defaultValues, reset]);

  async function onSubmit(data: OrganizationFormData) {
    try {
      await new Promise<void>((resolve, reject) => {
        guard(async () => {
          try {
            await mutateAsync({ ...data, totpCode });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
      toast.success(t('orgModalSaveSuccess'));
      onClose();
      reset();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('orgModalSaveFailed')));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('orgModalTitle')}
      subtitle={t('orgModalSubtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('orgModalFieldIdentifier')}
          required
          error={errors.identifier?.message}
          hint={
            defaultValues?.identifier ? t('identifierLockedHelp') : t('orgModalFieldIdentifierHint')
          }
        >
          <input
            {...register('identifier')}
            className={inputClass}
            placeholder={t('orgModalFieldIdentifierPlaceholder')}
            readOnly={!!defaultValues?.identifier}
            disabled={!!defaultValues?.identifier}
            title={defaultValues?.identifier ? t('identifierLockedHelp') : undefined}
            data-testid="org-identifier-input"
          />
          {defaultValues?.identifier && (
            <p
              className="text-[10px] mt-1 flex items-center gap-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                lock
              </span>
              <span>{t('identifierLocked')}</span>
            </p>
          )}
        </FormField>
        <FormField label={t('orgModalFieldName')} required error={errors.name?.message}>
          <input
            {...register('name')}
            className={inputClass}
            placeholder={t('orgModalFieldNamePlaceholder')}
          />
        </FormField>
        <FormField label={t('orgModalFieldEmail')} required error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            className={inputClass}
            placeholder={t('orgModalFieldEmailPlaceholder')}
          />
        </FormField>
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700">{t('orgModalActiveLabel')}</p>
            <p className="text-[10px] text-slate-400">{t('orgModalActiveHint')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" {...register('active')} className="sr-only peer" />
            <div className="w-10 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('orgModalFieldAddress')} error={errors.addressLine?.message}>
            <input
              {...register('addressLine')}
              className={inputClass}
              placeholder={t('orgModalFieldAddressPlaceholder')}
            />
          </FormField>
          <FormField label={t('orgModalFieldPostal')} error={errors.postalCode?.message}>
            <input
              {...register('postalCode')}
              className={inputClass}
              placeholder={t('orgModalFieldPostalPlaceholder')}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('orgModalFieldCity')} error={errors.city?.message}>
            <input
              {...register('city')}
              className={inputClass}
              placeholder={t('orgModalFieldCityPlaceholder')}
            />
          </FormField>
          <FormField
            label={t('orgModalFieldCountry')}
            error={errors.countryCode?.message}
            hint={t('orgModalFieldCountryHint')}
          >
            <input
              {...register('countryCode')}
              className={inputClass}
              placeholder="DE"
              maxLength={2}
            />
          </FormField>
        </div>
        <FormField
          label={t('orgModalFieldThumbprint')}
          error={errors.clientCertThumbprint?.message}
          hint={t('orgModalFieldThumbprintHint')}
        >
          <input
            {...register('clientCertThumbprint')}
            className={inputClass}
            placeholder={t('orgModalFieldThumbprintPlaceholder')}
            maxLength={128}
          />
        </FormField>
        {watch('clientCertThumbprint') !== (defaultValues?.clientCertThumbprint ?? '') && (
          <FormField
            label={t('orgModalThumbprintTotpLabel')}
            hint={t('orgModalThumbprintTotpHint')}
          >
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              style={{ fontFamily: 'monospace', letterSpacing: '4px', textAlign: 'center' }}
            />
          </FormField>
        )}
        <ModalFooter onCancel={onClose} loading={isPending} submitLabel={t('orgModalSaveBtn')} />
      </form>
    </Modal>
  );
}
