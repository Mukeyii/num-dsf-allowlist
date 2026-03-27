import { z } from 'zod';

const ROLES = ['DIC', 'HRP', 'DMS', 'AMS'] as const;

export const membershipSchema = z.object({
  parentOrganization: z.string().min(3, 'Parent organization is required'),
  endpointId: z.string().min(3, 'Endpoint is required'),
  roles: z.array(z.enum(ROLES)).min(1, 'Select at least one role'),
});

export type MembershipFormData = z.infer<typeof membershipSchema>;
