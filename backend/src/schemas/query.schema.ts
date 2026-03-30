/**
 * query.schema.ts – Zod validation for query parameters (audit, admin)
 */
import { z } from 'zod';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  resource: z.enum(['ORGANIZATION', 'CONTACT', 'ENDPOINT', 'CERTIFICATE', 'MEMBERSHIP', 'AUTH']).optional(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'OTP_REQUEST', 'OTP_VERIFY', 'TOTP_SETUP', 'TOTP_VERIFY']).optional(),
});
