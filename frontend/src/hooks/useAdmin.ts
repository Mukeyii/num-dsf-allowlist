/**
 * useAdmin.ts – React Query hooks for admin approval management
 * Dependencies: admin.api, tanstack/react-query
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type PendingRequest } from '../api/admin.api';

export function usePendingApprovals() {
  return useQuery<PendingRequest[]>({
    queryKey: ['admin', 'pending-approvals'],
    queryFn: () => adminApi.getPendingApprovals().then(r => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation<{ data: { status: 'PENDING' | 'APPROVED'; reason?: string } }, Error, { requestId: string; totpCode: string }>({
    mutationFn: ({ requestId, totpCode }) =>
      adminApi.approveRequest(requestId, totpCode).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] }),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, comment, totpCode }: { requestId: string; comment: string; totpCode: string }) =>
      adminApi.rejectRequest(requestId, comment, totpCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] }),
  });
}
