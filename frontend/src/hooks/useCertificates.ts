/**
 * useCertificates.ts — TanStack Query hooks for certificate list, create, delete, and renew.
 * Wraps the entities API; mutations invalidate certificates, approval-status, certs-expiring, activity-feed, and audit caches.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/entities.api';

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
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
      qc.invalidateQueries({ queryKey: ['certs-expiring', instanceId] });
      qc.invalidateQueries({ queryKey: ['activity-feed', instanceId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useDeleteCertificate(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(instanceId).deleteCertificate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificates', instanceId] });
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
      qc.invalidateQueries({ queryKey: ['certs-expiring', instanceId] });
      qc.invalidateQueries({ queryKey: ['activity-feed', instanceId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
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
      qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
      qc.invalidateQueries({ queryKey: ['certs-expiring', instanceId] });
      qc.invalidateQueries({ queryKey: ['activity-feed', instanceId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}
