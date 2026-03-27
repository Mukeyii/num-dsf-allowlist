import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { FormField, inputClass, ModalFooter } from './FormField';
import { endpointSchema, EndpointFormData } from '../../schemas/endpoint.schema';
import { useCreateEndpoint, useUpdateEndpoint } from '../../hooks/useEndpoints';

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  endpointId?: string;
  defaultValues?: Partial<EndpointFormData>;
}

export function EndpointModal({ open, onClose, instanceId, endpointId, defaultValues }: Props) {
  const createMut = useCreateEndpoint(instanceId);
  const updateMut = useUpdateEndpoint(instanceId);
  const isPending = createMut.isPending || updateMut.isPending;
  const { register, handleSubmit, control, formState: { errors } } = useForm<EndpointFormData>({
    resolver: zodResolver(endpointSchema),
    defaultValues: { ipAddresses: [{ ip: '', isFhir: false, isBpe: false }], ...defaultValues },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'ipAddresses' });

  async function onSubmit(data: EndpointFormData) {
    try {
      if (endpointId) {
        await updateMut.mutateAsync({ id: endpointId, data });
        toast.success('Endpoint updated.');
      } else {
        await createMut.mutateAsync(data);
        toast.success('Endpoint added.');
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save endpoint.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={endpointId ? 'Edit Endpoint' : 'Add New Endpoint'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Name" error={errors.name?.message} hint="For convenience only — not included in the allow list">
          <input {...register('name')} className={inputClass} placeholder="e.g. DSF Fhir PROD" />
        </FormField>
        <FormField label="Identifier (FQDN)" required error={errors.identifier?.message}>
          <input {...register('identifier')} className={inputClass} placeholder="e.g. dsf-fhir.hospital.de" />
        </FormField>
        <FormField label="Address (FHIR URL)" required error={errors.address?.message} hint="The FHIR endpoint URL of your DSF instance">
          <input {...register('address')} className={inputClass} placeholder="e.g. https://dsf-fhir.hospital.de/fhir" />
        </FormField>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-600">Associated IP Addresses</label>
            <button type="button" onClick={() => append({ ip: '', isFhir: false, isBpe: false })} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">+ Add IP</button>
          </div>
          <p className="text-[10px] text-slate-400 mb-3">Specify outgoing IP addresses so other organizations can configure their firewalls.</p>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <input {...register(`ipAddresses.${index}.ip`)} className={`${inputClass} flex-1`} placeholder="e.g. 128.176.232.132" />
                  <button type="button" onClick={() => remove(index)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" {...register(`ipAddresses.${index}.isFhir`)} className="accent-primary" />
                    <span className="font-medium">FHIR</span>
                    <span className="text-slate-400">outgoing IP of FHIR server</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" {...register(`ipAddresses.${index}.isBpe`)} className="accent-primary" />
                    <span className="font-medium">BPE</span>
                    <span className="text-slate-400">outgoing IP of BPE</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
        <ModalFooter onCancel={onClose} loading={isPending} submitLabel={endpointId ? 'Update Endpoint' : 'Add Endpoint'} />
      </form>
    </Modal>
  );
}
