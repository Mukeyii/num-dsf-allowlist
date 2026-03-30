import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, inputClass, ModalFooter } from './FormField';
import { organizationSchema, OrganizationFormData } from '../../schemas/organization.schema';
import { useUpdateOrganization } from '../../hooks/useOrganization';

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  defaultValues?: Partial<OrganizationFormData>;
}

export function OrganizationModal({ open, onClose, instanceId, defaultValues }: Props) {
  const { mutateAsync, isPending } = useUpdateOrganization(instanceId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { active: true, ...defaultValues },
  });

  useEffect(() => {
    if (open && defaultValues) {
      reset({ active: true, ...defaultValues });
    }
  }, [open, defaultValues, reset]);

  async function onSubmit(data: OrganizationFormData) {
    try {
      await mutateAsync(data);
      toast.success('Organization saved successfully.');
      onClose();
      reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save organization.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Organization" subtitle="Update your organization's details.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Identifier (FQDN)" required error={errors.identifier?.message} hint="Shortest FQDN of your organization's website, e.g. ukm.de">
          <input {...register('identifier')} className={inputClass} placeholder="e.g. ukm.de" />
        </FormField>
        <FormField label="Name" required error={errors.name?.message}>
          <input {...register('name')} className={inputClass} placeholder="e.g. Universitätsklinikum Münster" />
        </FormField>
        <FormField label="Email" required error={errors.email?.message}>
          <input {...register('email')} type="email" className={inputClass} placeholder="e.g. medic@hospital.de" />
        </FormField>
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700">Active</p>
            <p className="text-[10px] text-slate-400">Mark organization as active in the network</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" {...register('active')} className="sr-only peer" />
            <div className="w-10 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Address Line" error={errors.addressLine?.message}>
            <input {...register('addressLine')} className={inputClass} placeholder="e.g. Albert-Schweitzer-Campus 1" />
          </FormField>
          <FormField label="Postal Code" error={errors.postalCode?.message}>
            <input {...register('postalCode')} className={inputClass} placeholder="e.g. 48149" />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" error={errors.city?.message}>
            <input {...register('city')} className={inputClass} placeholder="e.g. Münster" />
          </FormField>
          <FormField label="Country Code" error={errors.countryCode?.message} hint="ISO 3166-1 alpha-2">
            <input {...register('countryCode')} className={inputClass} placeholder="DE" maxLength={2} />
          </FormField>
        </div>
        <FormField
          label="Client Certificate Thumbprint (SHA-256)"
          error={errors.clientCertThumbprint?.message}
          hint="For mTLS authentication — the DSF process uses this to authenticate when downloading the Allow List Bundle"
        >
          <input
            {...register('clientCertThumbprint')}
            className={inputClass}
            placeholder="e.g. a1b2c3d4e5f6..."
            maxLength={128}
          />
        </FormField>
        <ModalFooter onCancel={onClose} loading={isPending} submitLabel="Save Organization" />
      </form>
    </Modal>
  );
}
