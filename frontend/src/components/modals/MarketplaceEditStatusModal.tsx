/**
 * MarketplaceEditStatusModal.tsx – Admin modal to edit a marketplace entry's
 * status plus its DSF metadata and trust signals. Array fields are entered as
 * comma-separated text and split on submit. TOTP-gated via the meta endpoint.
 * Dependencies: Modal, FormField, useUpdateMarketplaceMeta, marketplace.schema,
 *               i18n.store, sonner
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, selectClass, inputClass, ModalFooter } from './FormField';
import { marketplaceEditFormSchema, MarketplaceEditForm } from '../../schemas/marketplace.schema';
import { useUpdateMarketplaceMeta } from '../../hooks/useMarketplace';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';
import type { MarketplaceEntry, MarketplaceMetaBody } from '../../api/marketplace.api';

interface Props {
  open: boolean;
  onClose: () => void;
  entryId: string;
  currentStatus: 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';
  // Optional: slug drives detail-query invalidation; entry prefills the fields.
  slug?: string;
  entry?: MarketplaceEntry;
}

/** Split a comma-separated input into a trimmed, non-empty array. */
function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MarketplaceEditStatusModal({
  open,
  onClose,
  entryId,
  currentStatus,
  slug,
  entry,
}: Props) {
  const { t } = useI18n();
  const updateMut = useUpdateMarketplaceMeta();

  function defaults(): MarketplaceEditForm {
    return {
      status: currentStatus,
      verified: entry?.verified ?? false,
      advisoryText: entry?.advisoryText ?? '',
      advisorySeverity: entry?.advisorySeverity ?? '',
      supersededBy: entry?.supersededBy ?? '',
      processIdentifiers: (entry?.processIdentifiers ?? []).join(', '),
      dsfVersionMin: entry?.dsfVersionMin ?? '',
      requiredRoles: (entry?.requiredRoles ?? []).join(', '),
      messageNames: (entry?.messageNames ?? []).join(', '),
      artifactUrl: entry?.artifactUrl ?? '',
      totpCode: '',
    };
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarketplaceEditForm>({
    resolver: zodResolver(marketplaceEditFormSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentStatus, entry, reset]);

  async function onSubmit(data: MarketplaceEditForm) {
    const body: MarketplaceMetaBody = {
      status: data.status,
      verified: data.verified,
      advisoryText: data.advisoryText?.trim() ? data.advisoryText.trim() : null,
      advisorySeverity: data.advisorySeverity ? data.advisorySeverity : null,
      supersededBy: data.supersededBy?.trim() ? data.supersededBy.trim() : null,
      processIdentifiers: splitCsv(data.processIdentifiers),
      dsfVersionMin: data.dsfVersionMin?.trim() ? data.dsfVersionMin.trim() : null,
      requiredRoles: splitCsv(data.requiredRoles),
      messageNames: splitCsv(data.messageNames),
      artifactUrl: data.artifactUrl?.trim() ? data.artifactUrl.trim() : null,
      totpCode: data.totpCode,
    };
    try {
      await updateMut.mutateAsync({ id: entryId, slug, body });
      toast.success(t('marketplaceEditMeta'));
      onClose();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, t('genericActionFailed'));
      toast.error(msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('marketplaceEditMeta')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label={t('marketplaceFieldStatus')} required error={errors.status?.message}>
          <select {...register('status')} className={selectClass}>
            <option value="APPROVED">{t('marketplaceStatusApproved')}</option>
            <option value="EXPERIMENTAL">{t('marketplaceStatusExperimental')}</option>
            <option value="DEPRECATED">{t('marketplaceStatusDeprecated')}</option>
          </select>
        </FormField>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" {...register('verified')} />
          {t('marketplaceVerified')}
        </label>

        <FormField label={t('marketplaceAdvisorySeverity')}>
          <select {...register('advisorySeverity')} className={selectClass}>
            <option value="">{t('marketplaceSeverityNone')}</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </FormField>

        <FormField label={t('marketplaceAdvisory')}>
          <textarea {...register('advisoryText')} className={inputClass} rows={2} />
        </FormField>

        <FormField label={t('marketplaceSupersededBy')}>
          <input {...register('supersededBy')} className={inputClass} placeholder="owner-repo" />
        </FormField>

        <FormField label={t('marketplaceProcessId')} hint={t('marketplaceCommaSeparated')}>
          <input {...register('processIdentifiers')} className={inputClass} />
        </FormField>

        <FormField label={t('marketplaceDsfVersion')}>
          <input {...register('dsfVersionMin')} className={inputClass} placeholder="1.5" />
        </FormField>

        <FormField label={t('marketplaceRequiredRoles')} hint={t('marketplaceCommaSeparated')}>
          <input {...register('requiredRoles')} className={inputClass} placeholder="DIC, HRP" />
        </FormField>

        <FormField label={t('marketplaceMessageNames')} hint={t('marketplaceCommaSeparated')}>
          <input {...register('messageNames')} className={inputClass} />
        </FormField>

        <FormField label={t('marketplaceArtifact')}>
          <input {...register('artifactUrl')} className={inputClass} />
        </FormField>

        <FormField label={t('totpCodeLabel')} required error={errors.totpCode?.message}>
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
          loading={updateMut.isPending}
          submitLabel={t('marketplaceEditMeta')}
        />
      </form>
    </Modal>
  );
}
