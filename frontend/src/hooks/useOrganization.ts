/**
 * useOrganization.ts — TanStack Query hooks to fetch and update the instance organization.
 * Wraps the entities API; update invalidates the organization plus the shared
 * post-mutation caches (see invalidateAfterEntityMutation).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';
import { invalidateAfterEntityMutation } from './useEntityInvalidation';

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
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}
