/**
 * statusColors.ts – Single source of truth for the certificate-status color
 * quartet shared across the map (pins, clusters, filters, detail panel).
 * Keyed by the cert_status enum used on MapOrganization.
 */
import type { MapOrganization } from '../api/network.api';

export const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID: '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED: '#ef4444',
  NONE: '#94a3b8',
};
