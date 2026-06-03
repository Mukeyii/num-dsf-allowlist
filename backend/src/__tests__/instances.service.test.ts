/**
 * instances.service.test.ts – DB-backed test for instances.service.
 * Exercises createInstance, getInstance, listForUser and renameInstance for a
 * non-admin owner (admin bypass paths are covered elsewhere).
 * Dependencies: db/connection, instances.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import {
  createInstance,
  getInstance,
  listForUser,
  renameInstance,
} from '../services/instances.service';

describe('instances.service', () => {
  const userId = uuidv4();
  const userEmail = `inst-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
  let createdId = '';

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: userEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      if (createdId) await db('instances').where({ id: createdId }).del();
    } finally {
      await db('users').where({ id: userId }).del();
    }
  });

  it('creates, fetches, lists and renames an instance', async () => {
    const created = await createInstance(userId, userEmail, '127.0.0.1');
    createdId = created.id;
    expect(created.user_id).toBe(userId);

    const fetched = await getInstance(createdId, userEmail);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(createdId);
    expect(fetched!.owner_email).toBe(userEmail);

    const list = await listForUser(userId, userEmail);
    expect(list.some((i) => i.id === createdId)).toBe(true);

    const renamed = await renameInstance(createdId, userId, 'new-label');
    expect(renamed!.label).toBe('new-label');
    const reFetched = await getInstance(createdId, userEmail);
    expect(reFetched!.label).toBe('new-label');
  });

  it('returns null for an unentitled caller', async () => {
    expect(await getInstance(createdId || uuidv4(), 'stranger@example.de')).toBeNull();
  });
});
