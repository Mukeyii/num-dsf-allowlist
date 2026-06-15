/**
 * useAdmin.ts – React Query hooks for admin approval management
 * Dependencies: admin.api, tanstack/react-query
 */
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { adminApi, type PendingRequest } from '../api/admin.api';

// A decision regenerates the published bundle and flips one instance's approval
// state, but the hook has no instanceId; invalidate approval keys by prefix so
// every instance refreshes (v5 invalidateQueries is prefix-matching by default).
function invalidateAfterDecision(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] });
  qc.invalidateQueries({ queryKey: ['network', 'map'] });
  qc.invalidateQueries({ queryKey: ['approval-status'] });
  qc.invalidateQueries({ queryKey: ['approval-history'] });
}

export function usePendingApprovals() {
  return useQuery<PendingRequest[]>({
    queryKey: ['admin', 'pending-approvals'],
    queryFn: () => adminApi.getPendingApprovals().then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation<
    { data: { status: 'PENDING' | 'APPROVED'; reason?: string } },
    Error,
    { requestId: string; totpCode: string }
  >({
    mutationFn: ({ requestId, totpCode }) =>
      adminApi.approveRequest(requestId, totpCode).then((r) => r.data),
    onSuccess: () => invalidateAfterDecision(qc),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      comment,
      totpCode,
    }: {
      requestId: string;
      comment: string;
      totpCode: string;
    }) => adminApi.rejectRequest(requestId, comment, totpCode),
    onSuccess: () => invalidateAfterDecision(qc),
  });
}
