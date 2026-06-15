/**
 * useCertificates.ts — TanStack Query hooks for certificate list, create, delete, and renew.
 * Wraps the entities API; mutations invalidate certificates and certs-expiring plus
 * the shared post-mutation caches (see invalidateAfterEntityMutation).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';
import { invalidateAfterEntityMutation } from './useEntityInvalidation';

export function useCertificates(instanceId: string | null) {
  return useQuery({
    queryKey: ['certificates', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getCertificates()
        .then((r) => r.data.data),
    enabled: !!instanceId,
    staleTime: 30_000,
  });
}

export function useCreateCertificate(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pem: string) => api(instanceId).createCertificate(pem),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificates', instanceId] });
      qc.invalidateQueries({ queryKey: ['certs-expiring', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}

export function useDeleteCertificate(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteCertificate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificates', instanceId] });
      qc.invalidateQueries({ queryKey: ['certs-expiring', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}

export function useRenewCertificate(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ certId, pem }: { certId: string; pem: string }) =>
      api(instanceId).renewCertificate(certId, pem),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificates', instanceId] });
      qc.invalidateQueries({ queryKey: ['certs-expiring', instanceId] });
      invalidateAfterEntityMutation(qc, instanceId);
    },
  });
}
