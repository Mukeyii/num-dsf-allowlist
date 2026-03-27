/**
 * endpoints.service.ts – CRUD for Endpoints including IP addresses
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

export async function getEndpoints(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];
  const endpoints = await db('endpoints').where({ organization_id: org.identifier });
  const ips = await db('endpoint_ips').whereIn('endpoint_id', endpoints.map((e: any) => e.identifier));
  return endpoints.map((ep: any) => ({
    ...ep,
    ipAddresses: ips.filter((ip: any) => ip.endpoint_id === ep.identifier).map((ip: any) => ({ id: ip.id, ip: ip.ip, isFhir: !!ip.is_fhir, isBpe: !!ip.is_bpe })),
  }));
}

export async function createEndpoint(instanceId: string, data: { identifier: string; name?: string; address: string; ipAddresses?: { ip: string; isFhir?: boolean; isBpe?: boolean }[] }, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const now = new Date();
  await db('endpoints').insert({ identifier: data.identifier, organization_id: org.identifier, name: data.name ?? null, address: data.address, created_at: now, updated_at: now });
  if (data.ipAddresses?.length) {
    await db('endpoint_ips').insert(data.ipAddresses.map(ip => ({ id: uuidv4(), endpoint_id: data.identifier, ip: ip.ip, is_fhir: ip.isFhir ? 1 : 0, is_bpe: ip.isBpe ? 1 : 0 })));
  }
  await writeAuditLog({ userEmail, instanceId, resourceType: 'ENDPOINT', resourceId: data.identifier, operation: 'CREATE', diffJson: { after: data }, ipAddress });
  return (await getEndpoints(instanceId)).find((e: any) => e.identifier === data.identifier);
}

export async function updateEndpoint(instanceId: string, endpointId: string, data: { name?: string; address?: string; ipAddresses?: { ip: string; isFhir?: boolean; isBpe?: boolean }[] }, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const endpoint = await db('endpoints').where({ identifier: endpointId, organization_id: org.identifier }).first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');
  const updates: Record<string, any> = { updated_at: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.address) updates.address = data.address;
  await db('endpoints').where({ identifier: endpointId }).update(updates);
  if (data.ipAddresses !== undefined) {
    await db('endpoint_ips').where({ endpoint_id: endpointId }).delete();
    if (data.ipAddresses.length) {
      await db('endpoint_ips').insert(data.ipAddresses.map(ip => ({ id: uuidv4(), endpoint_id: endpointId, ip: ip.ip, is_fhir: ip.isFhir ? 1 : 0, is_bpe: ip.isBpe ? 1 : 0 })));
    }
  }
  await writeAuditLog({ userEmail, instanceId, resourceType: 'ENDPOINT', resourceId: endpointId, operation: 'UPDATE', diffJson: { after: data }, ipAddress });
  return (await getEndpoints(instanceId)).find((e: any) => e.identifier === endpointId);
}

export async function deleteEndpoint(instanceId: string, endpointId: string, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const endpoint = await db('endpoints').where({ identifier: endpointId, organization_id: org.identifier }).first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');
  await db('endpoints').where({ identifier: endpointId }).delete();
  await writeAuditLog({ userEmail, instanceId, resourceType: 'ENDPOINT', resourceId: endpointId, operation: 'DELETE', ipAddress });
}
