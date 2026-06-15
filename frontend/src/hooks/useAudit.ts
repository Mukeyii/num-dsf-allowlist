/**
 * useAudit.ts – TanStack Query hook for the cross-instance audit log
 * Dependencies: @tanstack/react-query, audit.api
 */
import { useQuery } from '@tanstack/react-query';
import { getCrossInstanceAudit } from '../api/audit.api';

export function useCrossInstanceAudit(
  page: number = 1,
  limit: number = 50,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['audit', 'cross-instance', page, limit],
    queryFn: () => getCrossInstanceAudit({ page, limit }),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
