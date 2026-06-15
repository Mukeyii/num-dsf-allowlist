/**
 * useEndpoints.ts — TanStack Query hooks for endpoint list, create, update, and delete.
 * Wraps the entities API; mutations invalidate endpoints and approval-status caches.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';

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
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
      qc.invalidateQueries({ queryKey: ['activity-feed', instanceId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
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
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
      qc.invalidateQueries({ queryKey: ['activity-feed', instanceId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useDeleteEndpoint(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteEndpoint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoints', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
      qc.invalidateQueries({ queryKey: ['activity-feed', instanceId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}
