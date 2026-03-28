/**
 * useAdmin.ts – React Query hooks for admin approval management
 * Dependencies: admin.api, tanstack/react-query
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin.api';

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['admin', 'pending-approvals'],
    queryFn: () => adminApi.getPendingApprovals().then(r => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => adminApi.approveRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] }),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, comment }: { requestId: string; comment: string }) =>
      adminApi.rejectRequest(requestId, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] }),
  });
}
