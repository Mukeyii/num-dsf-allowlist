/**
 * useNetworkMap.ts – TanStack Query hook for the P2P network map data
 */
import { useQuery } from '@tanstack/react-query';
import { networkApi, MapResponse } from '../api/network.api';

export function useNetworkMap() {
  return useQuery<MapResponse>({
    queryKey: ['network', 'map'],
    queryFn: () =>
      networkApi.getMap().then((r) => ({
        organizations: r.data.data.organizations,
        isAdmin: r.data.meta.isAdmin,
      })),
    staleTime: 60_000,
  });
}
