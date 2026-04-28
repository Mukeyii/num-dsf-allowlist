/**
 * membership.schema.ts – Zod validation for membership input
 */
import { z } from 'zod';

const membershipRoles = z.enum(['DIC', 'HRP', 'DMS', 'AMS']);

export const createMembershipSchema = z.object({
  parentOrganization: z.string().min(1).max(255),
  endpointId: z.string().min(1).max(255),
  roles: z.array(membershipRoles).min(1),
});

export const updateMembershipSchema = z.object({
  parentOrganization: z.string().min(1).max(255).optional(),
  endpointId: z.string().min(1).max(255).optional(),
  roles: z.array(membershipRoles).min(1).optional(),
});
