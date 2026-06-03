/**
 * useApproval.ts — TanStack Query hooks for approval status, history, and submission.
 * Wraps the entities API; submit invalidates approval-status and approval-history caches.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';

export function useApprovalStatus(instanceId: string | null) {
  return useQuery({
    queryKey: ['approval-status', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getApprovalStatus()
        .then((r) => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useApprovalHistory(instanceId: string | null) {
  return useQuery({
    queryKey: ['approval-history', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getApprovalHistory()
        .then((r) => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useSubmitApproval(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(instanceId).submitApproval(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-history', instanceId] });
    },
  });
}
