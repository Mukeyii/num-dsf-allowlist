/**
 * admin-promotions.service.test.ts – Service-layer tests for the 4-eyes
 * admin-promotion request lifecycle (the create + list-pending side, which
 * does NOT require TOTP at the service layer).
 *
 * The requester must be a verified admin, so we seed a signed admin_grants
 * row with signGrant (same pattern as helpers/seed.ts). The target must be
 * whitelisted, unlocked and not already an admin.
 *
 * Dependencies: db/connection, admin-promotions.service, lib/adminGrants
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { signGrant } from '../lib/adminGrants';
import {
  createPromotionRequest,
  listPendingPromotions,
  PromotionError,
} from '../services/admin-promotions.service';

describe('admin-promotions.service – create + list pending', () => {
  const stamp = Date.now();
  const requester = `promo-admin-${stamp}@imi.uni-muenster.de`;
  const target = `promo-target-${stamp}@charite.de`;
  let createdId = '';

  beforeAll(async () => {
    // Requester: whitelisted + verified admin grant.
    await db('email_whitelist').insert({
      id: uuidv4(),
      email: requester,
      created_by: 'test',
      created_at: new Date(),
    });
    await db('users').insert({
      id: uuidv4(),
      email: requester,
      totp_enabled: false,
      created_at: new Date(),
    });
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(requester, grantedAt, 'SYSTEM:test', 'SYSTEM:test');
    await db('admin_grants').insert({
      email: requester,
      granted_at: grantedAt,
      granted_by_a: 'SYSTEM:test',
      granted_by_b: 'SYSTEM:test',
      signature_hex: sig,
    });
    // Target: whitelisted, unlocked, not an admin.
    await db('email_whitelist').insert({
      id: uuidv4(),
      email: target,
      created_by: 'test',
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('admin_promotion_requests').where({ target_email: target }).del();
    } finally {
      await db('audit_logs').whereIn('user_email', [requester]).del();
      await db('admin_grants').where({ email: requester }).del();
      await db('users').where({ email: requester }).del();
      await db('email_whitelist').whereIn('email', [requester, target]).del();
    }
  });

  it('creates a PENDING promotion request for a whitelisted target', async () => {
    const { id } = await createPromotionRequest(target, requester);
    createdId = id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);

    const row = await db('admin_promotion_requests').where({ id }).first();
    expect(row.target_email).toBe(target);
    expect(row.requested_by).toBe(requester);
    expect(row.status).toBe('PENDING');
  });

  it('lists the new request among pending promotions', async () => {
    const pending = await listPendingPromotions();
    const mine = pending.find((p) => p.id === createdId);
    expect(mine).toBeDefined();
    expect(mine!.status).toBe('PENDING');
    expect(mine!.target_email).toBe(target);
  });

  it('rejects a second pending request for the same target (ALREADY_PENDING)', async () => {
    await expect(createPromotionRequest(target, requester)).rejects.toMatchObject({
      code: 'ALREADY_PENDING',
    });
  });

  it('rejects a request from a non-admin requester (NOT_ADMIN)', async () => {
    const stranger = `stranger-${uuidv4()}@example.de`;
    await expect(createPromotionRequest(target, stranger)).rejects.toMatchObject({
      code: 'NOT_ADMIN',
    });
    await expect(createPromotionRequest(target, stranger)).rejects.toThrow(PromotionError);
  });
});
