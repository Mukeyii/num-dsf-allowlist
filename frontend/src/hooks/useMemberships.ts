/**
 * useMemberships.ts — TanStack Query hooks for membership list, create, update, and delete.
 * Wraps the entities API; mutations invalidate the memberships list plus the shared
 * post-mutation caches (see invalidateAfterEntityMutation).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';
import { invalidateAfterEntityMutation } from './useEntityInvalidation';

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
      invalidateAfterEntityMutation(qc, instanceId);
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
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}

export function useDeleteMembership(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteMembership(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}
