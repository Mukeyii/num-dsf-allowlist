/**
 * auditQuery.service.test.ts – DB-backed read-side tests for auditQuery.service.
 * Seeds a handful of audit_logs rows for one fresh instance and asserts that
 * listInstanceAudit filters by resource_type / operation and paginates.
 * Dependencies: db/connection, auditQuery.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { listInstanceAudit } from '../services/auditQuery.service';

describe('auditQuery.service – listInstanceAudit', () => {
  const userId = uuidv4();
  const instanceId = uuidv4();
  const email = `audit-${Date.now()}@example.de`;

  // Deterministic timestamps (newest last in this array) so ordering is testable.
  const base = Date.now();
  const seedRows = [
    { resource_type: 'ORGANIZATION', operation: 'CREATE', offset: 0 },
    { resource_type: 'CONTACT', operation: 'CREATE', offset: 1000 },
    { resource_type: 'CONTACT', operation: 'UPDATE', offset: 2000 },
    { resource_type: 'CONTACT', operation: 'DELETE', offset: 3000 },
    { resource_type: 'ENDPOINT', operation: 'CREATE', offset: 4000 },
  ];

  beforeAll(async () => {
    await db('users').insert({ id: userId, email, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'audit-svc', created_at: new Date() });
    for (const r of seedRows) {
      await db('audit_logs').insert({
        id: uuidv4(),
        timestamp: new Date(base + r.offset),
        user_email: email,
        instance_id: instanceId,
        resource_type: r.resource_type,
        resource_id: uuidv4(),
        operation: r.operation,
        diff_json: null,
        ip_address: '127.0.0.1',
      });
    }
  });

  afterAll(async () => {
    try {
      await db('audit_logs').where({ instance_id: instanceId }).del();
    } finally {
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('returns all rows for the instance with the correct total, newest-first', async () => {
    const page = await listInstanceAudit(instanceId, { page: 1, limit: 100 });
    expect(page.total).toBe(seedRows.length);
    expect(page.rows.length).toBe(seedRows.length);
    // orderBy timestamp desc → first row is the newest (largest offset).
    expect(page.rows[0].resource_type).toBe('ENDPOINT');
  });

  it('filters by resource_type', async () => {
    const page = await listInstanceAudit(instanceId, { page: 1, limit: 100, resource: 'CONTACT' });
    expect(page.total).toBe(3);
    expect(page.rows.length).toBe(3);
    expect(page.rows.every(r => r.resource_type === 'CONTACT')).toBe(true);
  });

  it('filters by resource_type AND operation together', async () => {
    const page = await listInstanceAudit(instanceId, {
      page: 1, limit: 100, resource: 'CONTACT', operation: 'UPDATE',
    });
    expect(page.total).toBe(1);
    expect(page.rows.length).toBe(1);
    expect(page.rows[0].resource_type).toBe('CONTACT');
    expect(page.rows[0].operation).toBe('UPDATE');
  });

  it('paginates: total stays full while each page is bounded by limit', async () => {
    const p1 = await listInstanceAudit(instanceId, { page: 1, limit: 2 });
    const p2 = await listInstanceAudit(instanceId, { page: 2, limit: 2 });
    const p3 = await listInstanceAudit(instanceId, { page: 3, limit: 2 });
    expect(p1.total).toBe(seedRows.length);
    expect(p1.rows.length).toBe(2);
    expect(p2.rows.length).toBe(2);
    expect(p3.rows.length).toBe(1);
    const ids = [...p1.rows, ...p2.rows, ...p3.rows].map(r => r.id);
    expect(new Set(ids).size).toBe(seedRows.length); // no overlap across pages
  });
});
