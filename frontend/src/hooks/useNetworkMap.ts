/**
 * useNetworkMap.ts – TanStack Query hook for the P2P network map data
 */
import { useQuery } from '@tanstack/react-query';
import { networkApi, MapOrganization } from '../api/network.api';

export function useNetworkMap() {
  return useQuery<MapOrganization[]>({
    queryKey: ['network', 'map'],
    queryFn: () => networkApi.getMap().then(r => r.data.data.organizations),
    staleTime: 60_000,
  });
}
