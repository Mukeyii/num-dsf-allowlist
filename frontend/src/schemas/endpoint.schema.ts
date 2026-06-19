/**
 * endpoint.schema.ts — Zod schema for endpoint form input (FQDN identifier, https URL, IP list).
 * Validates each IP as IPv4 with FHIR/BPE flags.
 */
import { z } from 'zod';

const ipv4Regex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

const ipAddressSchema = z.object({
  ip: z.string().regex(ipv4Regex, 'endpointIpInvalid'),
  isFhir: z.boolean().default(false),
  isBpe: z.boolean().default(false),
});

export const endpointSchema = z.object({
  identifier: z
    .string()
    .min(3, 'endpointIdentifierTooShort')
    .regex(
      /^(?=.{1,253}\.?$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+\.?$/,
      'endpointFqdnInvalid',
    ),
  name: z.string().optional(),
  address: z.string().url('endpointUrlInvalid').startsWith('https://', 'endpointUrlHttps'),
  ipAddresses: z.array(ipAddressSchema).default([]),
});

export type EndpointFormData = z.infer<typeof endpointSchema>;
