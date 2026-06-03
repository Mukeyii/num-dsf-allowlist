/**
 * EndpointModal.tsx — add/edit modal for a FHIR endpoint with a dynamic IP-address field array.
 * React Hook Form + endpointSchema; create/update through useEndpoints behind the cross-user guard.
 */
import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, inputClass, ModalFooter } from './FormField';
import { endpointSchema, EndpointFormData } from '../../schemas/endpoint.schema';
import { useCreateEndpoint, useUpdateEndpoint, useEndpoints } from '../../hooks/useEndpoints';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  endpointId?: string;
  defaultValues?: Partial<EndpointFormData>;
}

export function EndpointModal({ open, onClose, instanceId, endpointId, defaultValues }: Props) {
  const { t } = useI18n();
  const createMut = useCreateEndpoint(instanceId);
  const updateMut = useUpdateEndpoint(instanceId);
  const isPending = createMut.isPending || updateMut.isPending;
  const guard = useCrossUserGuard();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EndpointFormData>({
    resolver: zodResolver(endpointSchema),
    defaultValues: { ipAddresses: [{ ip: '', isFhir: false, isBpe: false }], ...defaultValues },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'ipAddresses' });

  const { data: endpoints = [] } = useEndpoints(instanceId);

  useEffect(() => {
    if (open && endpointId) {
      const ep = endpoints.find((e: any) => e.identifier === endpointId);
      if (ep) {
        reset({
          identifier: ep.identifier,
          name: ep.name || '',
          address: ep.address,
          ipAddresses: (ep.ipAddresses || []).map((ip: any) => ({
            ip: ip.ip,
            isFhir: !!ip.isFhir,
            isBpe: !!ip.isBpe,
          })),
        });
      }
    } else if (open && !endpointId) {
      reset({
        identifier: '',
        name: '',
        address: '',
        ipAddresses: [{ ip: '', isFhir: false, isBpe: false }],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, endpointId, reset]);

  async function onSubmit(data: EndpointFormData) {
    try {
      if (endpointId) {
        await new Promise<void>((resolve, reject) => {
          guard(async () => {
            try {
              await updateMut.mutateAsync({ id: endpointId, data });
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
        toast.success(t('endpointModalUpdateSuccess'));
      } else {
        await new Promise<void>((resolve, reject) => {
          guard(async () => {
            try {
              await createMut.mutateAsync(data);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
        toast.success(t('endpointModalAddSuccess'));
      }
      onClose();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('endpointModalSaveFailed')));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={endpointId ? t('endpointModalTitleEdit') : t('endpointModalTitleAdd')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('endpointModalFieldName')}
          error={errors.name?.message}
          hint={t('endpointModalFieldNameHint')}
        >
          <input
            {...register('name')}
            className={inputClass}
            placeholder={t('endpointModalFieldNamePlaceholder')}
          />
        </FormField>
        <FormField
          label={t('endpointModalFieldIdentifier')}
          required
          error={errors.identifier?.message}
          hint={endpointId ? t('identifierLockedHelp') : undefined}
        >
          <input
            {...register('identifier')}
            className={inputClass}
            placeholder={t('endpointModalFieldIdentifierPlaceholder')}
            readOnly={!!endpointId}
            disabled={!!endpointId}
            title={endpointId ? t('identifierLockedHelp') : undefined}
            data-testid="endpoint-identifier-input"
          />
          {endpointId && (
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
        <FormField
          label={t('endpointModalFieldAddress')}
          required
          error={errors.address?.message}
          hint={t('endpointModalFieldAddressHint')}
        >
          <input
            {...register('address')}
            className={inputClass}
            placeholder={t('endpointModalFieldAddressPlaceholder')}
          />
        </FormField>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-600">
              {t('endpointModalIpLabel')}
            </label>
            <button
              type="button"
              onClick={() => append({ ip: '', isFhir: false, isBpe: false })}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {t('endpointModalAddIp')}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mb-3">{t('endpointModalIpHint')}</p>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    {...register(`ipAddresses.${index}.ip`)}
                    className={`${inputClass} flex-1`}
                    placeholder={t('endpointModalIpPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register(`ipAddresses.${index}.isFhir`)}
                      className="accent-primary"
                    />
                    <span className="font-medium">{t('endpointModalFhirLabel')}</span>
                    <span className="text-slate-400">{t('endpointModalFhirDesc')}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register(`ipAddresses.${index}.isBpe`)}
                      className="accent-primary"
                    />
                    <span className="font-medium">{t('endpointModalBpeLabel')}</span>
                    <span className="text-slate-400">{t('endpointModalBpeDesc')}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
        <ModalFooter
          onCancel={onClose}
          loading={isPending}
          submitLabel={endpointId ? t('endpointModalUpdateBtn') : t('endpointModalAddBtn')}
        />
      </form>
    </Modal>
  );
}
