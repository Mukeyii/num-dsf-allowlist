import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';

export function useOrganization(instanceId: string | null) {
  return useQuery({
    queryKey: ['organization', instanceId],
    queryFn: () => api(instanceId!).getOrganization().then(r => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useUpdateOrganization(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => api(instanceId).updateOrganization(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization', instanceId] }),
  });
}
