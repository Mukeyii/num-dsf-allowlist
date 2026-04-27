import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, inputClass, ModalFooter } from './FormField';
import { contactSchema, ContactFormData } from '../../schemas/contact.schema';
import { useCreateContact, useUpdateContact, useContacts } from '../../hooks/useContacts';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';

const TYPES = [
  { value: 'MEDIC', label: 'MEDIC', desc: 'Person responsible for the organization' },
  { value: 'DSF_ADMIN', label: 'DSF_ADMIN', desc: 'Technical administration of the DSF' },
  { value: 'SECURITY', label: 'SECURITY', desc: 'Contact for security issues' },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  contactId?: string;
  defaultValues?: Partial<ContactFormData>;
}

export function ContactModal({ open, onClose, instanceId, contactId, defaultValues }: Props) {
  const createMut = useCreateContact(instanceId);
  const updateMut = useUpdateContact(instanceId);
  const isPending = createMut.isPending || updateMut.isPending;
  const guard = useCrossUserGuard();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { types: [], ...defaultValues },
  });

  const { data: contacts = [] } = useContacts(instanceId);

  useEffect(() => {
    if (open && contactId) {
      const c = contacts.find((ct: any) => ct.id === contactId);
      if (c) {
        const types = Array.isArray(c.types) ? c.types : JSON.parse(c.types || '[]');
        reset({
          types,
          name: c.name || '',
          email: c.email,
          phone: c.phone || '',
          addressLine: c.address_line || '',
          postalCode: c.postal_code || '',
          city: c.city || '',
          countryCode: c.country_code || '',
        });
      }
    } else if (open && !contactId) {
      reset({ types: [], name: '', email: '', phone: '', addressLine: '', postalCode: '', city: '', countryCode: '' });
    }
  }, [open, contactId, contacts, reset]);

  async function onSubmit(data: ContactFormData) {
    try {
      if (contactId) {
        await new Promise<void>((resolve, reject) => {
          guard(async () => {
            try { await updateMut.mutateAsync({ id: contactId, data }); resolve(); } catch (e) { reject(e); }
          });
        });
        toast.success('Contact updated.');
      } else {
        await new Promise<void>((resolve, reject) => {
          guard(async () => {
            try { await createMut.mutateAsync(data); resolve(); } catch (e) { reject(e); }
          });
        });
        toast.success('Contact added.');
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save contact.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={contactId ? 'Edit Contact' : 'Add New Contact'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs text-indigo-700">Contact data will <strong>not</strong> be shared in the allow list. It is used for internal DSF communication only.</p>
        </div>
        <FormField label="Types" required error={errors.types?.message}>
          <Controller name="types" control={control} render={({ field }) => (
            <div className="space-y-2">
              {TYPES.map(({ value, label, desc }) => (
                <label key={value} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 cursor-pointer transition-all">
                  <input type="checkbox" value={value} checked={field.value?.includes(value)}
                    onChange={e => { if (e.target.checked) { field.onChange([...(field.value || []), value]); } else { field.onChange(field.value?.filter((v: string) => v !== value)); } }}
                    className="mt-0.5 accent-primary" />
                  <div>
                    <span className="text-xs font-bold text-slate-700">{label}</span>
                    <p className="text-[10px] text-slate-400">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          )} />
        </FormField>
        <FormField label="Name" error={errors.name?.message} hint="Or organization name">
          <input {...register('name')} className={inputClass} placeholder="e.g. Max Mustermann" />
        </FormField>
        <FormField label="Email" required error={errors.email?.message} hint="Used for DSF community communication">
          <input {...register('email')} type="email" className={inputClass} placeholder="e.g. medic@hospital.de" />
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          <input {...register('phone')} className={inputClass} placeholder="e.g. +491231523455" />
        </FormField>
        <FormField label="Address Line" error={errors.addressLine?.message}>
          <input {...register('addressLine')} className={inputClass} placeholder="e.g. Max-Planck-Str. 39" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Postal Code" error={errors.postalCode?.message}>
            <input {...register('postalCode')} className={inputClass} placeholder="74081" />
          </FormField>
          <FormField label="City" error={errors.city?.message}>
            <input {...register('city')} className={inputClass} placeholder="Heilbronn" />
          </FormField>
        </div>
        <FormField label="Country Code" error={errors.countryCode?.message}>
          <input {...register('countryCode')} className={inputClass} placeholder="DE" maxLength={2} />
        </FormField>
        <ModalFooter onCancel={onClose} loading={isPending} submitLabel={contactId ? 'Update Contact' : 'Add Contact'} />
      </form>
    </Modal>
  );
}
