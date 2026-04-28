/**
 * endpoint.schema.ts – Zod validation for endpoint input
 */
import { z } from 'zod';

const ipv4Regex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

const ipAddressSchema = z.object({
  ip: z.string().regex(ipv4Regex, 'Must be a valid IPv4 address'),
  isFhir: z.boolean().optional().default(false),
  isBpe: z.boolean().optional().default(false),
});

export const createEndpointSchema = z.object({
  identifier: z.string().min(1).max(255),
  name: z.string().max(255).optional().default(''),
  address: z.string().url().max(500),
  ipAddresses: z.array(ipAddressSchema).optional().default([]),
});

export const updateEndpointSchema = z.object({
  name: z.string().max(255).optional(),
  address: z.string().url().max(500).optional(),
  ipAddresses: z.array(ipAddressSchema).optional(),
});
