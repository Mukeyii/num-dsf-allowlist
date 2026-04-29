/**
 * useMarketplace.ts – TanStack Query hooks for marketplace
 * Dependencies: @tanstack/react-query, marketplace.api
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, MarketplaceEntry } from '../api/marketplace.api';

const KEY = ['marketplace'];

export function useMarketplace() {
  return useQuery<MarketplaceEntry[]>({
    queryKey: KEY,
    queryFn: () => marketplaceApi.list().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddMarketplace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { gitUrl: string; status: string; totpCode: string }) =>
      marketplaceApi.add(body).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateMarketplaceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: string; totpCode: string } }) =>
      marketplaceApi.patch(id, body).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMarketplaceEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { totpCode: string } }) =>
      marketplaceApi.remove(id, body).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
