import { z } from 'zod';

const ipv4Regex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

const ipAddressSchema = z.object({
  ip: z.string().regex(ipv4Regex, 'Must be a valid IPv4 address (e.g. 192.168.1.1)'),
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
