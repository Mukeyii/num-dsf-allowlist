import { z } from 'zod';

const ipAddressSchema = z.object({
  ip: z.string().min(7, 'Enter a valid IP address'),
  isFhir: z.boolean().default(false),
  isBpe: z.boolean().default(false),
});

export const endpointSchema = z.object({
  identifier: z.string().min(3).regex(/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/, 'Must be a valid FQDN'),
  name: z.string().optional(),
  address: z.string().url('Must be a valid URL').startsWith('https://', 'URL must start with https://'),
  ipAddresses: z.array(ipAddressSchema).default([]),
});

export type EndpointFormData = z.infer<typeof endpointSchema>;
