/**
 * useMemberships.ts — TanStack Query hooks for membership list, create, update, and delete.
 * Wraps the entities API; mutations invalidate memberships and approval-status caches.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';

export function useMemberships(instanceId: string | null) {
  return useQuery({
    queryKey: ['memberships', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getMemberships()
        .then((r) => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useCreateMembership(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => api(instanceId).createMembership(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
    },
  });
}

export function useUpdateMembership(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api(instanceId).updateMembership(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
    },
  });
}

export function useDeleteMembership(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteMembership(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
    },
  });
}
