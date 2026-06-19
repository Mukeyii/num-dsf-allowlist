/**
 * membership.schema.ts — Zod schema for membership form input (parent org, endpoint, roles).
 * Requires a parent organization, an endpoint, and at least one role (DIC/HRP/DMS/AMS).
 */
import { z } from 'zod';

const ROLES = ['DIC', 'HRP', 'DMS', 'AMS'] as const;

export const membershipSchema = z.object({
  parentOrganization: z.string().min(3, 'membershipParentRequired'),
  endpointId: z.string().min(3, 'membershipEndpointRequired'),
  roles: z.array(z.enum(ROLES)).min(1, 'membershipRolesRequired'),
});

export type MembershipFormData = z.infer<typeof membershipSchema>;
