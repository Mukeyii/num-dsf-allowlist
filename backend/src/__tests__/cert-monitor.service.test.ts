/**
 * cert-monitor.service.test.ts – DB-backed test for runCertExpiryCheck.
 * Seeds a unique org with a DSF_ADMIN contact and a certificate expiring ~10
 * days out, then asserts the (mocked) sendCertExpiryWarning is called and
 * last_notified_at gets stamped. notification.service + audit.service are
 * mocked so no mail is sent and no audit row is written.
 * Dependencies: db/connection, cert-monitor.service, notification.service, audit.service
 */
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/notification.service', () => ({
  sendCertExpiryWarning: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/audit.service', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { db } from '../db/connection';
import { runCertExpiryCheck, toUtcMidnight } from '../services/cert-monitor.service';
import { sendCertExpiryWarning } from '../services/notification.service';

describe('cert-monitor.service – runCertExpiryCheck', () => {
  const org = `svc-certmon-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const certId = uuidv4();
  const contactId = uuidv4();
  const adminEmail = 'security@certmon.example.de';

  // 7 days out → matches the [..,7,..] notify schedule and is < 90 days.
  const validUntil = new Date();
  validUntil.setUTCHours(0, 0, 0, 0);
  validUntil.setDate(validUntil.getDate() + 7);
  const validUntilDate = validUntil.toISOString().slice(0, 10);

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
      label: 'certmon',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: org,
      instance_id: instanceId,
      name: 'CertMon',
      active: 1,
      email: 'x@x.de',
      address_line: 'x',
      postal_code: '0',
      city: 'x',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('contacts').insert({
      id: contactId,
      organization_id: org,
      types: JSON.stringify(['DSF_ADMIN']),
      name: 'Admin',
      email: adminEmail,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('certificates').insert({
      id: certId,
      organization_id: org,
      pem: '-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----',
      subject: 'CN=certmon',
      thumbprint: 'a'.repeat(40),
      valid_until: validUntilDate,
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('certificates').where({ id: certId }).del();
      await db('contacts').where({ organization_id: org }).del();
    } finally {
      await db('organizations').where({ identifier: org }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('notifies the org admin and stamps last_notified_at for an expiring cert', async () => {
    await runCertExpiryCheck();

    expect(sendCertExpiryWarning as jest.Mock).toHaveBeenCalled();
    const calledWith = (sendCertExpiryWarning as jest.Mock).mock.calls.find(
      (c) => c[0] === adminEmail,
    );
    expect(calledWith).toBeDefined();

    const cert = await db('certificates').where({ id: certId }).first();
    expect(cert.last_notified_at).not.toBeNull();
  });
});

describe('cert-monitor.service – toUtcMidnight date basis', () => {
  it('parses a YYYY-MM-DD string to that calendar date at UTC midnight', () => {
    expect(toUtcMidnight('2026-09-12')).toBe(Date.UTC(2026, 8, 12));
  });

  it('maps a Date at LOCAL midnight to its calendar date at UTC midnight', () => {
    // new Date(y, m, d) is LOCAL midnight; on a non-UTC host its raw epoch is
    // offset, but the day count must still come out whole. Using the date's
    // calendar components (not its epoch) makes the result host-independent.
    const local = new Date(2026, 8, 12); // local midnight, Sep 12 2026
    expect(toUtcMidnight(local)).toBe(Date.UTC(2026, 8, 12));
  });

  it('yields a whole-day difference against a UTC-midnight today', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const sevenOut = new Date(today.getTime() + 7 * 86400000);
    const iso = sevenOut.toISOString().slice(0, 10);
    expect((toUtcMidnight(iso) - today.getTime()) / 86400000).toBe(7);
  });
});

describe('cert-monitor.service – malformed contact types isolation', () => {
  const org = `svc-certmon-bad-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const certId = uuidv4();
  const badContactId = uuidv4();
  const goodContactId = uuidv4();
  const badEmail = 'broken@certmon-bad.example.de';
  const goodEmail = 'security@certmon-bad.example.de';

  const validUntil = new Date();
  validUntil.setUTCHours(0, 0, 0, 0);
  validUntil.setDate(validUntil.getDate() + 7);
  const validUntilDate = validUntil.toISOString().slice(0, 10);

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
      label: 'certmon-bad',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: org,
      instance_id: instanceId,
      name: 'CertMonBad',
      active: 1,
      email: 'x@x.de',
      address_line: 'x',
      postal_code: '0',
      city: 'x',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    // A contact whose types column holds a non-array JSON value. The column is
    // JSON-typed so MySQL rejects unparseable text, but a stored object still
    // breaks the old `.includes` filter — under the previous code this threw at
    // the certificate level and suppressed EVERY recipient of the cert.
    await db('contacts').insert({
      id: badContactId,
      organization_id: org,
      types: JSON.stringify({ bogus: true }),
      name: 'Broken',
      email: badEmail,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('contacts').insert({
      id: goodContactId,
      organization_id: org,
      types: JSON.stringify(['SECURITY']),
      name: 'Security',
      email: goodEmail,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('certificates').insert({
      id: certId,
      organization_id: org,
      pem: '-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----',
      subject: 'CN=certmon-bad',
      thumbprint: 'b'.repeat(40),
      valid_until: validUntilDate,
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('certificates').where({ id: certId }).del();
      await db('contacts').where({ organization_id: org }).del();
    } finally {
      await db('organizations').where({ identifier: org }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('still notifies the valid SECURITY contact when another contact has malformed types', async () => {
    (sendCertExpiryWarning as jest.Mock).mockClear();
    await runCertExpiryCheck();

    const calls = (sendCertExpiryWarning as jest.Mock).mock.calls;
    expect(calls.find((c) => c[0] === goodEmail)).toBeDefined();
    // The malformed contact is skipped, not treated as a recipient.
    expect(calls.find((c) => c[0] === badEmail)).toBeUndefined();
  });
});
