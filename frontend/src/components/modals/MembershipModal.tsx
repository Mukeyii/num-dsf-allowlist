import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, selectClass, ModalFooter } from './FormField';
import { membershipSchema, MembershipFormData } from '../../schemas/membership.schema';
import { parseJsonArray } from '../../lib/parseJsonArray';
import { useCreateMembership, useUpdateMembership, useMemberships } from '../../hooks/useMemberships';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';

const PARENT_ORGS = ['medizininformatik-initiative.de', 'netzwerk-universitaetsmedizin.de', 'eyematics.org', 'dktk.dkfz.de'];
const ROLES = [
  { value: 'DIC', label: 'DIC', desc: 'Data Integration Center' },
  { value: 'HRP', label: 'HRP', desc: 'Health Research Platform' },
  { value: 'DMS', label: 'DMS', desc: 'Data Management Site' },
  { value: 'AMS', label: 'AMS', desc: 'Allow-List Management Site' },
] as const;

interface Props { open: boolean; onClose: () => void; instanceId: string; membershipId?: string; defaultValues?: Partial<MembershipFormData>; }

export function MembershipModal({ open, onClose, instanceId, membershipId, defaultValues }: Props) {
  const { t } = useI18n();
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const createMut = useCreateMembership(instanceId);
  const updateMut = useUpdateMembership(instanceId);
  const isPending = createMut.isPending || updateMut.isPending;
  const guard = useCrossUserGuard();
  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
    defaultValues: { roles: [], ...defaultValues },
  });

  const { data: memberships = [] } = useMemberships(instanceId);
  const currentParent = watch('parentOrganization');

  useEffect(() => {
    if (open && membershipId) {
      const ms = memberships.find((m: any) => m.id === membershipId);
      if (ms) {
        const roles = parseJsonArray(ms.roles) as MembershipFormData['roles'];
        reset({
          parentOrganization: ms.parent_organization,
          endpointId: ms.endpoint_id || '',
          roles,
        });
      }
    } else if (open && !membershipId) {
      reset({ parentOrganization: '', endpointId: '', roles: [] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, membershipId, reset]);

  async function onSubmit(data: MembershipFormData) {
    try {
      if (membershipId) {
        await new Promise<void>((resolve, reject) => {
          guard(async () => {
            try { await updateMut.mutateAsync({ id: membershipId, data }); resolve(); } catch (e) { reject(e); }
          });
        });
        toast.success(t('membershipModalUpdateSuccess'));
      } else {
        await new Promise<void>((resolve, reject) => {
          guard(async () => {
            try { await createMut.mutateAsync(data); resolve(); } catch (e) { reject(e); }
          });
        });
        toast.success(t('membershipModalAddSuccess'));
      }
      onClose();
    } catch (err: any) { toast.error(getErrorMessage(err, t('membershipModalSaveFailed'))); }
  }

  return (
    <Modal open={open} onClose={onClose} title={membershipId ? t('membershipModalTitleEdit') : t('membershipModalTitleAdd')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label={t('membershipModalFieldParent')} required error={errors.parentOrganization?.message}>
          <select {...register('parentOrganization')} className={selectClass}>
            <option value="">{t('membershipModalFieldParentPlaceholder')}</option>
            {currentParent && !PARENT_ORGS.includes(currentParent) && (
              <option value={currentParent}>{currentParent}</option>
            )}
            {PARENT_ORGS.map(org => (<option key={org} value={org}>{org}</option>))}
          </select>
        </FormField>
        <FormField label={t('membershipModalFieldEndpoint')} required error={errors.endpointId?.message} hint={t('membershipModalFieldEndpointHint')}>
          <select {...register('endpointId')} className={selectClass}>
            <option value="">{t('membershipModalFieldEndpointPlaceholder')}</option>
            {endpoints.map((ep: any) => (<option key={ep.identifier} value={ep.identifier}>{ep.name || ep.identifier} ({ep.address})</option>))}
          </select>
        </FormField>
        <FormField label={t('membershipModalFieldRoles')} required error={errors.roles?.message}>
          <Controller name="roles" control={control} render={({ field }) => (
            <div className="space-y-2">
              {ROLES.map(({ value, label, desc }) => (
                <label key={value} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 cursor-pointer transition-all">
                  <input type="checkbox" value={value} checked={field.value?.includes(value)}
                    onChange={e => { if (e.target.checked) { field.onChange([...(field.value || []), value]); } else { field.onChange(field.value?.filter((v: string) => v !== value)); } }}
                    className="mt-0.5 accent-primary" />
                  <div><span className="text-xs font-bold text-slate-700">{label}</span><p className="text-[10px] text-slate-400">{desc}</p></div>
                </label>
              ))}
            </div>
          )} />
        </FormField>
        <ModalFooter onCancel={onClose} loading={isPending} submitLabel={membershipId ? t('membershipModalUpdateBtn') : t('membershipModalAddBtn')} />
      </form>
    </Modal>
  );
}
