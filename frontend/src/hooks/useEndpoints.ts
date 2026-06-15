/**
 * useEndpoints.ts — TanStack Query hooks for endpoint list, create, update, and delete.
 * Wraps the entities API; mutations invalidate the endpoints list plus the shared
 * post-mutation caches (see invalidateAfterEntityMutation); update/delete also
 * invalidate memberships since those reference endpoint_id.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';
import { invalidateAfterEntityMutation } from './useEntityInvalidation';

export function useEndpoints(instanceId: string | null) {
  return useQuery({
    queryKey: ['endpoints', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getEndpoints()
        .then((r) => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useCreateEndpoint(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => api(instanceId).createEndpoint(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoints', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}

export function useUpdateEndpoint(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api(instanceId).updateEndpoint(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoints', instanceId] });
      // memberships reference endpoint_id; a renamed identifier orphans them
      qc.invalidateQueries({ queryKey: ['memberships', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}

export function useDeleteEndpoint(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteEndpoint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoints', instanceId] });
      // memberships reference endpoint_id; a deleted endpoint orphans them
      qc.invalidateQueries({ queryKey: ['memberships', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}
