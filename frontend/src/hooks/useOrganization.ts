/**
 * useOrganization.ts — TanStack Query hooks to fetch and update the instance organization.
 * Wraps the entities API; update invalidates organization and approval-status caches.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';

export function useOrganization(instanceId: string | null) {
  return useQuery({
    queryKey: ['organization', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getOrganization()
        .then((r) => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useUpdateOrganization(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => api(instanceId).updateOrganization(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
    },
  });
}
