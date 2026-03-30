/**
 * membership.schema.ts – Zod validation for membership input
 */
import { z } from 'zod';

const membershipRoles = z.enum(['DIC', 'HRP', 'DMS', 'AMS']);

export const createMembershipSchema = z.object({
  organizationId: z.string().min(1).max(255),
  parentOrganization: z.string().min(1).max(255),
  endpointId: z.string().max(255).optional().nullable(),
  roles: z.array(membershipRoles).min(1),
});

export const updateMembershipSchema = z.object({
  parentOrganization: z.string().min(1).max(255).optional(),
  endpointId: z.string().max(255).optional().nullable(),
  roles: z.array(membershipRoles).min(1).optional(),
});
