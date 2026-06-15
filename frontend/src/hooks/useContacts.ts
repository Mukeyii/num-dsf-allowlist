/**
 * useContacts.ts — TanStack Query hooks for contact list, create, update, and delete.
 * Wraps the entities API; mutations invalidate the contacts list plus the shared
 * post-mutation caches (see invalidateAfterEntityMutation).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';
import { invalidateAfterEntityMutation } from './useEntityInvalidation';

export function useContacts(instanceId: string | null) {
  return useQuery({
    queryKey: ['contacts', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getContacts()
        .then((r) => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useCreateContact(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => api(instanceId).createContact(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}

export function useUpdateContact(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api(instanceId).updateContact(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}

export function useDeleteContact(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}
