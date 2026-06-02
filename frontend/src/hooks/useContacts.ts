/**
 * useContacts.ts — TanStack Query hooks for contact list, create, update, and delete.
 * Wraps the entities API; mutations invalidate contacts and approval-status caches.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';

export function useContacts(instanceId: string | null) {
  return useQuery({
    queryKey: ['contacts', instanceId],
    queryFn: () => api(instanceId!).getContacts().then(r => r.data.data),
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
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
    },
  });
}

export function useUpdateContact(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => api(instanceId).updateContact(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
    },
  });
}

export function useDeleteContact(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
    },
  });
}
