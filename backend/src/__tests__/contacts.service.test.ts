/**
 * contacts.service.test.ts – DB-backed CRUD test for contacts.service.
 * Exercises getContacts/createContact/updateContact/deleteContact, which all
 * key on instanceId and resolve the owning org internally.
 * Dependencies: db/connection, contacts.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from '../services/contacts.service';

describe('contacts.service', () => {
  const org = `svc-contacts-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const email = 'caller@example.de';

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: `${userId}@x.de`,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'svc',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: org,
      instance_id: instanceId,
      name: 'Svc',
      active: 1,
      email: 'x@x.de',
      address_line: 'x',
      postal_code: '0',
      city: 'x',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('contacts').where({ organization_id: org }).del();
    } finally {
      await db('organizations').where({ identifier: org }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('creates, lists, updates and deletes a contact', async () => {
    const created = await createContact(
      instanceId,
      { types: ['MEDIC'], name: 'Dr X', email: 'm@x.de' },
      email,
      '127.0.0.1',
    );
    expect(created).toBeTruthy();
    const contactId = created!.id as string;

    const listed = await getContacts(instanceId);
    expect(listed.some((r: any) => r.id === contactId && r.email === 'm@x.de')).toBe(true);

    const updated = await updateContact(
      instanceId,
      contactId,
      { name: 'Dr Y' },
      email,
      '127.0.0.1',
    );
    expect(updated!.name).toBe('Dr Y');

    await deleteContact(instanceId, contactId, email, '127.0.0.1');
    const after = await getContacts(instanceId);
    expect(after.some((r: any) => r.id === contactId)).toBe(false);
  });
});
