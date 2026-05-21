/**
 * seed-testdata.ts – Populate DB with fictional test data for development
 * Usage: npx ts-node src/db/seed-testdata.ts
 *
 * ALL data is fictional. No real person names, emails, domains, or IPs.
 * Domains use .example.de (RFC 2606). IPs use RFC 5737 test ranges.
 */
import 'dotenv/config';
import { db } from './connection';
import { v4 as uuidv4 } from 'uuid';
import { signGrant } from '../lib/adminGrants';

const USER_ID = uuidv4();
const ADMIN_EMAIL = 'admin@imi-test.example.de';

const MEMBER_USER_ID = uuidv4();
const MEMBER_EMAIL = 'member@imi-test.example.de';
const MEMBER_INSTANCE_ID = uuidv4();
const MEMBER_ORG_IDENTIFIER = 'universitaetsklinikum-member.example.de';

const SITE_USER_ID = uuidv4();
const SITE_EMAIL = 'site@imi-test.example.de';
const SITE_INSTANCE_ID = uuidv4();
const SITE_ORG_IDENTIFIER = 'kreiskrankenhaus-site.example.de';

const GREEK = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'My', 'Ny', 'Xi', 'Omikron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Ypsilon', 'Phi', 'Chi', 'Psi', 'Omega',
  'Astra', 'Nova', 'Orion', 'Vega', 'Lyra', 'Rigel',
];

const ORG_TYPES = ['Klinikum', 'Universitätsklinik', 'Kreiskrankenhaus', 'Stadtklinik', 'Forschungsklinik'];
// Real German cities — must match keys in frontend/src/lib/germanCities.ts so map pins
// land on the silhouette instead of in the right-edge "Sonstige" stripe. Repeats
// (Berlin ×3, Hamburg ×2, München ×2, Münster ×1, Heidelberg ×1) deliberately seed
// city clusters so the cluster-pin UX gets exercised.
const CITIES = [
  'Berlin',           'Hamburg',          'München',
  'Köln',             'Frankfurt am Main','Stuttgart',
  'Düsseldorf',       'Leipzig',          'Dresden',
  'Hannover',         'Bremen',           'Münster',
  'Heidelberg',       'Nürnberg',         'Karlsruhe',
  'Mainz',            'Essen',            'Dortmund',
  'Bonn',             'Augsburg',         'Würzburg',
  'Magdeburg',        'Rostock',          'Kiel',
  'Berlin',           'Hamburg',          'München',
  'Berlin',           'Münster',          'Freiburg',
];
const STREETS = ['Hauptstr.', 'Bahnhofstr.', 'Musterweg', 'Testgasse', 'Beispielplatz', 'Demoallee', 'Probenring'];
const FIRST_NAMES = ['Max', 'Anna', 'Felix', 'Julia', 'Markus', 'Sophie', 'Thomas', 'Elena', 'Peter', 'Claudia'];
const LAST_NAMES = ['Mustermann', 'Musterfrau', 'Testperson', 'Beispiel', 'Platzhalter', 'Dummy', 'Probst', 'Fiktiv', 'Demo', 'Sample'];
const CONTACT_TYPES = [['MEDIC'], ['DSF_ADMIN'], ['SECURITY'], ['MEDIC', 'DSF_ADMIN'], ['DSF_ADMIN', 'SECURITY']];
const ROLES_POOL = [['DIC'], ['DMS'], ['HRP'], ['DIC', 'HRP'], ['DIC', 'DMS'], ['DMS', 'AMS'], ['DIC', 'HRP', 'DMS']];
const PARENT_ORGS = ['mii-testverband.example.de', 'num-testverband.example.de'];

// IP ranges: RFC 5737 documentation ranges only
const IP_BASES = ['192.0.2', '198.51.100', '203.0.113'];

const FAKE_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALRiMLAh2wLSMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC7o96HtiMR+dqpMgLzOPSx
5IAoMpOZzFMqxA7E5JN9GK5FdJoG9brkCaJMnoYhbyXjxyoGS2YqvECRnpc1bN0z
AgMBAAEwDQYJKoZIhvcNAQELBQADQQBY7lY1eByq0TA6M2qHTHmao+mSjHR8hEIq
b7dUjzKHYESSYsXoPNMiPiX85ysSGrFcdPt4MfrDXJe9Zk/3RmeO
-----END CERTIFICATE-----`;

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] || c)).replace(/\s+/g, '-');
}

function thumbprint(index: number): string {
  const hex = index.toString(16).padStart(2, '0');
  return (hex + 'abcdef0123456789').repeat(4).slice(0, 64);
}

// Generate 30 organizations
const INSTANCES = GREEK.map((name, i) => ({
  id: uuidv4(),
  label: `${ORG_TYPES[i % ORG_TYPES.length]} ${name}`,
}));

const ORGS = GREEK.map((name, i) => {
  const orgType = ORG_TYPES[i % ORG_TYPES.length];
  const domain = `${slug(orgType)}-${name.toLowerCase()}.example.de`;
  return {
    identifier: domain,
    instanceId: INSTANCES[i].id,
    name: `${orgType} ${name}`,
    email: `dsf-admin@${domain}`,
    addressLine: `${STREETS[i % STREETS.length]} ${(i + 1) * 10}`,
    postalCode: String(10000 + i * 1111).slice(0, 5),
    city: CITIES[i],
    countryCode: 'DE',
  };
});

async function main() {
  console.log('Seeding 30 fictional test organizations...\n');

  // 0. Clean previous seed data (cascade deletes children)
  await db('audit_logs').whereIn('user_email', [ADMIN_EMAIL, MEMBER_EMAIL, SITE_EMAIL]).del();
  await db('approval_requests').whereIn('instance_id',
    db('instances').select('id').whereIn('user_id', [USER_ID, MEMBER_USER_ID, SITE_USER_ID])).del();
  await db('instances').whereIn('user_id', [USER_ID, MEMBER_USER_ID, SITE_USER_ID]).del();
  await db('users').whereIn('email', [ADMIN_EMAIL, MEMBER_EMAIL, SITE_EMAIL]).del();
  // Clean multi-admin/user enrichment fixtures (added in block 13)
  await db('admin_promotion_requests').whereIn('requested_by', [ADMIN_EMAIL]).del();
  // Delete by email (not granted_by_a) so any pre-existing bootstrap rows with
  // potentially-stale signatures are wiped and the seed's re-bootstrap can
  // create fresh, correctly-signed rows.
  const seedManagedAdminEmails = [
    ADMIN_EMAIL,
    'admin-charite@charite-test.example.de',
    'admin-koeln@uk-koeln-test.example.de',
    ...(process.env.IMI_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
  ];
  await db('admin_grants').whereIn('email', seedManagedAdminEmails).del();
  await db('email_whitelist').whereIn('email', [
    'admin-charite@charite-test.example.de',
    'admin-koeln@uk-koeln-test.example.de',
    'user1@kkh-mitte-test.example.de',
    'user2@kkh-mitte-test.example.de',
    'user3@uk-rostock-test.example.de',
    'user4@uk-bochum-test.example.de',
    'user5@uk-erlangen-test.example.de',
    'gesperrt@kkh-leer-test.example.de',
  ]).del();
  // Marketplace fixtures (block 14)
  await db('marketplace_entries').where({ added_by: 'SYSTEM:seed' }).del();
  // CA-blacklist fixtures (block 15)
  await db('ca_blacklist').where({ added_by: 'SYSTEM:seed' }).del();
  // Bundle-version history (block 16) — admin-triggered rows only, leaves any
  // manual-trigger rows a developer created interactively alone.
  await db('bundle_versions').where({ triggered_by_email: ADMIN_EMAIL }).del();
  console.log('  [~] Cleaned previous seed data');

  // 1. Whitelist admin
  await db('email_whitelist').insert({
    id: uuidv4(), email: ADMIN_EMAIL, created_by: 'seed', created_at: new Date(),
  }).onConflict('email').ignore();
  console.log(`  [+] Whitelisted: ${ADMIN_EMAIL}`);

  // 2. Create user
  await db('users').insert({
    id: USER_ID, email: ADMIN_EMAIL, totp_enabled: false, created_at: new Date(),
  }).onConflict('email').ignore();

  // 3. Create instances
  for (const inst of INSTANCES) {
    await db('instances').insert({
      id: inst.id, user_id: USER_ID, label: inst.label, created_at: new Date(),
    }).onConflict('id').ignore();
  }
  console.log(`  [+] ${INSTANCES.length} instances`);

  // 4. Create organizations (mix of active/inactive)
  let activeCount = 0, inactiveCount = 0;
  for (let i = 0; i < ORGS.length; i++) {
    const org = ORGS[i];
    // ~2/3 active, ~1/3 inactive — every 3rd org is inactive
    const active = i % 3 !== 2;
    if (active) activeCount++; else inactiveCount++;
    await db('organizations').insert({
      identifier: org.identifier, instance_id: org.instanceId,
      name: org.name, active, email: org.email,
      address_line: org.addressLine, postal_code: org.postalCode,
      city: org.city, country_code: org.countryCode,
      created_at: new Date(), updated_at: new Date(),
    }).onConflict('identifier').ignore();
  }
  console.log(`  [+] ${ORGS.length} organizations (${activeCount} active, ${inactiveCount} inactive)`);

  // 5. Contacts (2 per org = 60)
  let contactCount = 0;
  for (let i = 0; i < ORGS.length; i++) {
    for (let j = 0; j < 2; j++) {
      const fi = (i * 2 + j) % FIRST_NAMES.length;
      const li = (i * 2 + j) % LAST_NAMES.length;
      const prefix = j === 0 ? 'Dr.' : 'Prof. Dr.';
      await db('contacts').insert({
        id: uuidv4(),
        organization_id: ORGS[i].identifier,
        types: JSON.stringify(CONTACT_TYPES[(i * 2 + j) % CONTACT_TYPES.length]),
        name: `${prefix} ${FIRST_NAMES[fi]} ${LAST_NAMES[li]}`,
        email: `${FIRST_NAMES[fi].toLowerCase()}.${LAST_NAMES[li].toLowerCase()}@${ORGS[i].identifier}`,
        email_validated: j === 0,
        phone: `+4930${String(1000000 + i * 10000 + j).slice(0, 7)}`,
        address_line: ORGS[i].addressLine,
        city: ORGS[i].city,
        postal_code: ORGS[i].postalCode,
        country_code: 'DE',
        created_at: new Date(), updated_at: new Date(),
      });
      contactCount++;
    }
  }
  console.log(`  [+] ${contactCount} contacts`);

  // 6. Endpoints (1-2 per org, ~40 total) + IPs
  let endpointCount = 0;
  let ipCount = 0;
  for (let i = 0; i < ORGS.length; i++) {
    const numEndpoints = i % 3 === 0 ? 2 : 1; // every 3rd org gets 2 endpoints
    for (let e = 0; e < numEndpoints; e++) {
      const epSuffix = e === 0 ? '' : '-bpe';
      const identifier = `dsf-fhir${epSuffix}.${ORGS[i].identifier}`;
      await db('endpoints').insert({
        identifier,
        organization_id: ORGS[i].identifier,
        name: e === 0 ? `DSF FHIR ${GREEK[i]}` : `DSF BPE ${GREEK[i]}`,
        address: `https://${identifier}/fhir`,
        created_at: new Date(), updated_at: new Date(),
      }).onConflict('identifier').ignore();
      endpointCount++;

      // 1-2 IPs per endpoint
      const numIps = (i + e) % 2 === 0 ? 2 : 1;
      for (let ip = 0; ip < numIps; ip++) {
        const base = IP_BASES[(i + e + ip) % IP_BASES.length];
        await db('endpoint_ips').insert({
          id: uuidv4(),
          endpoint_id: identifier,
          ip: `${base}.${(i * 3 + e * 10 + ip + 1) % 254 + 1}`,
          is_fhir: e === 0,
          is_bpe: e === 1 || ip === 1,
        });
        ipCount++;
      }
    }
  }
  console.log(`  [+] ${endpointCount} endpoints, ${ipCount} IPs`);

  // 7. Certificates (varied expiry; every 7th org has none)
  // Cover VALID (>30d), EXPIRING (<30d, >0), EXPIRED (<0). NONE via skipping.
  const EXPIRY_DAYS = [730, 365, 180, 90, 60, 25, 10, 3, -5, -30];
  let certCount = 0;
  for (let i = 0; i < ORGS.length; i++) {
    if (i % 7 === 6) continue; // no certificate for this org
    await db('certificates').insert({
      id: uuidv4(),
      organization_id: ORGS[i].identifier,
      pem: FAKE_PEM,
      subject: `CN=dsf-fhir.${ORGS[i].identifier}`,
      thumbprint: thumbprint(i),
      valid_until: futureDate(EXPIRY_DAYS[i % EXPIRY_DAYS.length]),
      created_at: new Date(),
    });
    certCount++;
  }
  console.log(`  [+] ${certCount} certificates`);

  // 8. Memberships (1-2 per org)
  let membershipCount = 0;
  for (let i = 0; i < ORGS.length; i++) {
    const numMemberships = i % 4 === 0 ? 2 : 1;
    for (let m = 0; m < numMemberships; m++) {
      const epId = `dsf-fhir.${ORGS[i].identifier}`;
      await db('memberships').insert({
        id: uuidv4(),
        organization_id: ORGS[i].identifier,
        parent_organization: PARENT_ORGS[(i + m) % PARENT_ORGS.length],
        endpoint_id: epId,
        roles: JSON.stringify(ROLES_POOL[(i + m) % ROLES_POOL.length]),
        created_at: new Date(), updated_at: new Date(),
      });
      membershipCount++;
    }
  }
  console.log(`  [+] ${membershipCount} memberships`);

  // 9. Approval requests – 20 orgs APPROVED so they appear on the network map,
  //                      plus a few PENDING/REJECTED for realism.
  //                      Snapshot mirrors approval.service.ts:buildSnapshot so
  //                      the Approval Review page renders the full org card.
  type ApprovalSpec = { instanceIdx: number; status: 'APPROVED' | 'PENDING' | 'REJECTED'; daysAgo: number };
  const approvals: ApprovalSpec[] = [];
  for (let i = 0; i < 20; i++) {
    approvals.push({ instanceIdx: i, status: 'APPROVED', daysAgo: 60 - (i % 45) });
  }
  approvals.push({ instanceIdx: 21, status: 'PENDING',  daysAgo: 3 });
  approvals.push({ instanceIdx: 22, status: 'PENDING',  daysAgo: 1 });
  approvals.push({ instanceIdx: 23, status: 'REJECTED', daysAgo: 14 });
  approvals.push({ instanceIdx: 24, status: 'REJECTED', daysAgo: 6 });

  async function seedSnapshot(instanceId: string) {
    const org = await db('organizations').where({ instance_id: instanceId }).first();
    if (!org) return null;
    const contacts   = await db('contacts').where({ organization_id: org.identifier })
      .select('id', 'types', 'name', 'email', 'email_validated', 'phone', 'city', 'country_code');
    const endpoints  = await db('endpoints').where({ organization_id: org.identifier });
    const ips        = await db('endpoint_ips').whereIn('endpoint_id', endpoints.map((e: any) => e.identifier));
    const certificates = await db('certificates').where({ organization_id: org.identifier })
      .select('id', 'subject', 'thumbprint', 'valid_until');
    const memberships  = await db('memberships').where({ organization_id: org.identifier });
    return {
      organization: org,
      contacts,
      endpoints: endpoints.map((ep: any) => ({
        ...ep,
        ips: ips.filter((ip: any) => ip.endpoint_id === ep.identifier),
      })),
      certificates,
      memberships,
      snapshotAt: new Date().toISOString(),
    };
  }

  for (const a of approvals) {
    const snap = await seedSnapshot(INSTANCES[a.instanceIdx].id);
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: INSTANCES[a.instanceIdx].id,
      status: a.status,
      created_at: pastDate(a.daysAgo),
      submitted_at: pastDate(a.daysAgo),
      resolved_at: a.status !== 'PENDING' ? pastDate(Math.max(a.daysAgo - 1, 0)) : null,
      resolved_by: a.status !== 'PENDING' ? ADMIN_EMAIL : null,
      comment: a.status === 'REJECTED' ? 'Zertifikat abgelaufen, bitte erneuern.' : null,
      snapshot_json: JSON.stringify(snap ?? { note: `Test ${a.status}` }),
    });
  }
  console.log(`  [+] ${approvals.length} approval requests (20 APPROVED + ${approvals.length - 20} other, with full snapshots)`);

  // 10. Audit log entries
  const auditOps = ['LOGIN', 'CREATE', 'UPDATE', 'CREATE', 'CREATE', 'CREATE', 'CREATE', 'APPROVE', 'REJECT', 'LOGOUT'];
  const auditResources = ['AUTH', 'ORGANIZATION', 'ORGANIZATION', 'CONTACT', 'ENDPOINT', 'CERTIFICATE', 'MEMBERSHIP', 'APPROVAL', 'APPROVAL', 'AUTH'];
  for (let i = 0; i < auditOps.length; i++) {
    await db('audit_logs').insert({
      id: uuidv4(),
      timestamp: pastDate(Math.floor(Math.random() * 30)),
      user_email: ADMIN_EMAIL,
      instance_id: INSTANCES[i % INSTANCES.length].id,
      resource_type: auditResources[i],
      resource_id: i < 2 ? ORGS[0].identifier : uuidv4().slice(0, 8),
      operation: auditOps[i],
      diff_json: null,
      ip_address: '198.51.100.1',
    });
  }
  console.log(`  [+] ${auditOps.length} audit entries`);

  // 11. Non-admin member user: whitelisted, one instance, minimal org + approved request.
  //     Used to test the role-aware views (map, admin page). Not in IMI_ADMIN_EMAILS.
  await db('email_whitelist').insert({
    id: uuidv4(), email: MEMBER_EMAIL, created_by: 'seed', created_at: new Date(),
  }).onConflict('email').ignore();
  await db('users').insert({
    id: MEMBER_USER_ID, email: MEMBER_EMAIL, totp_enabled: false, created_at: new Date(),
  }).onConflict('email').ignore();
  await db('instances').insert({
    id: MEMBER_INSTANCE_ID, user_id: MEMBER_USER_ID,
    label: 'Universitätsklinikum Member', created_at: new Date(),
  }).onConflict('id').ignore();
  await db('organizations').insert({
    identifier: MEMBER_ORG_IDENTIFIER, instance_id: MEMBER_INSTANCE_ID,
    name: 'Universitätsklinikum Member', active: true,
    email: `dsf-admin@${MEMBER_ORG_IDENTIFIER}`,
    address_line: 'Beispielweg 1', postal_code: '48149',
    city: 'Münster', country_code: 'DE',
    created_at: new Date(), updated_at: new Date(),
  }).onConflict('identifier').ignore();
  await db('contacts').insert({
    id: uuidv4(), organization_id: MEMBER_ORG_IDENTIFIER,
    types: JSON.stringify(['DSF_ADMIN']),
    name: 'Dr. Member Contact', email: `dsf-admin@${MEMBER_ORG_IDENTIFIER}`,
    email_validated: true, phone: '+49301234567',
    address_line: 'Beispielweg 1', city: 'Münster',
    postal_code: '48149', country_code: 'DE',
    created_at: new Date(), updated_at: new Date(),
  });
  const memberEpId = `dsf-fhir.${MEMBER_ORG_IDENTIFIER}`;
  await db('endpoints').insert({
    identifier: memberEpId, organization_id: MEMBER_ORG_IDENTIFIER,
    name: 'DSF FHIR Member', address: `https://${memberEpId}/fhir`,
    created_at: new Date(), updated_at: new Date(),
  }).onConflict('identifier').ignore();
  await db('endpoint_ips').insert({
    id: uuidv4(), endpoint_id: memberEpId,
    ip: '192.0.2.50', is_fhir: true, is_bpe: false,
  });
  await db('certificates').insert({
    id: uuidv4(), organization_id: MEMBER_ORG_IDENTIFIER,
    pem: FAKE_PEM, subject: `CN=${memberEpId}`,
    thumbprint: thumbprint(99),
    valid_until: futureDate(365),
    created_at: new Date(),
  });
  await db('memberships').insert({
    id: uuidv4(), organization_id: MEMBER_ORG_IDENTIFIER,
    parent_organization: PARENT_ORGS[0],
    endpoint_id: memberEpId,
    roles: JSON.stringify(['DIC']),
    created_at: new Date(), updated_at: new Date(),
  });
  await db('approval_requests').insert({
    id: uuidv4(), instance_id: MEMBER_INSTANCE_ID,
    status: 'APPROVED',
    created_at: pastDate(30), submitted_at: pastDate(30),
    resolved_at: pastDate(29), resolved_by: ADMIN_EMAIL, comment: null,
    snapshot_json: JSON.stringify({
      organization: { identifier: MEMBER_ORG_IDENTIFIER, name: 'Universitätsklinikum Member' },
    }),
  });
  console.log(`  [+] Member user seeded: ${MEMBER_EMAIL} (1 instance, 1 org APPROVED)`);

  // 12. Non-admin site user: whitelisted, one instance with an unsubmitted draft
  //     (org + contact + endpoint + cert + membership but NO approval_request yet).
  //     Useful for exercising the submit-for-approval flow end-to-end.
  await db('email_whitelist').insert({
    id: uuidv4(), email: SITE_EMAIL, created_by: 'seed', created_at: new Date(),
  }).onConflict('email').ignore();
  await db('users').insert({
    id: SITE_USER_ID, email: SITE_EMAIL, totp_enabled: false, created_at: new Date(),
  }).onConflict('email').ignore();
  await db('instances').insert({
    id: SITE_INSTANCE_ID, user_id: SITE_USER_ID,
    label: 'Kreiskrankenhaus Site', created_at: new Date(),
  }).onConflict('id').ignore();
  await db('organizations').insert({
    identifier: SITE_ORG_IDENTIFIER, instance_id: SITE_INSTANCE_ID,
    name: 'Kreiskrankenhaus Site', active: true,
    email: `dsf-admin@${SITE_ORG_IDENTIFIER}`,
    address_line: 'Teststraße 42', postal_code: '69115',
    city: 'Heidelberg', country_code: 'DE',
    created_at: new Date(), updated_at: new Date(),
  }).onConflict('identifier').ignore();
  await db('contacts').insert({
    id: uuidv4(), organization_id: SITE_ORG_IDENTIFIER,
    types: JSON.stringify(['DSF_ADMIN']),
    name: 'Dr. Site Contact', email: `dsf-admin@${SITE_ORG_IDENTIFIER}`,
    email_validated: true, phone: '+49301234999',
    address_line: 'Teststraße 42', city: 'Heidelberg',
    postal_code: '69115', country_code: 'DE',
    created_at: new Date(), updated_at: new Date(),
  });
  const siteEpId = `dsf-fhir.${SITE_ORG_IDENTIFIER}`;
  await db('endpoints').insert({
    identifier: siteEpId, organization_id: SITE_ORG_IDENTIFIER,
    name: 'DSF FHIR Site', address: `https://${siteEpId}/fhir`,
    created_at: new Date(), updated_at: new Date(),
  }).onConflict('identifier').ignore();
  await db('endpoint_ips').insert({
    id: uuidv4(), endpoint_id: siteEpId,
    ip: '192.0.2.99', is_fhir: true, is_bpe: false,
  });
  await db('certificates').insert({
    id: uuidv4(), organization_id: SITE_ORG_IDENTIFIER,
    pem: FAKE_PEM, subject: `CN=${siteEpId}`,
    thumbprint: thumbprint(88),
    valid_until: futureDate(365),
    created_at: new Date(),
  });
  await db('memberships').insert({
    id: uuidv4(), organization_id: SITE_ORG_IDENTIFIER,
    parent_organization: PARENT_ORGS[0],
    endpoint_id: siteEpId,
    roles: JSON.stringify(['DIC']),
    created_at: new Date(), updated_at: new Date(),
  });
  // Intentionally NO approval_request — lets the user exercise Submit-for-Approval.
  console.log(`  [+] Site user seeded: ${SITE_EMAIL} (1 instance, 1 org draft, no approval yet)`);

  // --- Multi-admin + multi-user enrichment for /app/admin/users dev-time UX ---
  const EXTRA_ADMINS = [
    { email: 'admin-charite@charite-test.example.de', site: 'charite-test.example.de' },
    { email: 'admin-koeln@uk-koeln-test.example.de',  site: 'uk-koeln-test.example.de'  },
  ];

  for (const { email } of EXTRA_ADMINS) {
    await db('email_whitelist').insert({ id: uuidv4(), email, created_at: new Date(), created_by: 'seed' }).onConflict('email').ignore();
    await db('users').insert({ id: uuidv4(), email, totp_enabled: true, created_at: new Date() }).onConflict('email').ignore();
    // granted_at must be whole-second precision (MySQL TIMESTAMP).
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(email, grantedAt, 'SYSTEM:seed', 'SYSTEM:seed');
    await db('admin_grants').insert({
      email,
      granted_at: grantedAt,
      granted_by_a: 'SYSTEM:seed',
      granted_by_b: 'SYSTEM:seed',
      signature_hex: sig,
    }).onConflict('email').ignore();
    console.log(`  [+] Admin seeded: ${email}`);
  }

  // 5 regular users (whitelisted, NOT admin, no users-row yet — never logged in)
  const REGULAR_USERS = [
    'user1@kkh-mitte-test.example.de',
    'user2@kkh-mitte-test.example.de',
    'user3@uk-rostock-test.example.de',
    'user4@uk-bochum-test.example.de',
    'user5@uk-erlangen-test.example.de',
  ];
  for (const email of REGULAR_USERS) {
    await db('email_whitelist').insert({ id: uuidv4(), email, created_at: new Date(), created_by: ADMIN_EMAIL }).onConflict('email').ignore();
  }
  console.log(`  [+] ${REGULAR_USERS.length} regular users whitelisted`);

  // 1 locked user (locked at seed time, with a reason)
  const LOCKED_USER_EMAIL = 'gesperrt@kkh-leer-test.example.de';
  await db('email_whitelist').insert({
    id: uuidv4(),
    email: LOCKED_USER_EMAIL,
    created_at: new Date(),
    created_by: ADMIN_EMAIL,
    locked_at: new Date(),
    locked_by: ADMIN_EMAIL,
    locked_reason: 'Verlängerung der Mitgliedschaft offen',
  }).onConflict('email').ignore();
  console.log(`  [+] Locked user seeded: ${LOCKED_USER_EMAIL}`);

  // 1 pending promotion request (target = first regular user)
  const PROMOTION_TARGET = REGULAR_USERS[0];
  await db('admin_promotion_requests').insert({
    id: uuidv4(),
    target_email: PROMOTION_TARGET,
    requested_by: ADMIN_EMAIL,
    requested_at: new Date(),
    status: 'PENDING',
  });
  console.log(`  [+] Pending promotion seeded: ${PROMOTION_TARGET}`);

  // Re-bootstrap the IMI_ADMIN_EMAILS-listed admins (so re-seed doesn't break dev login).
  const imiEmails = (process.env.IMI_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  for (const email of imiEmails) {
    await db('email_whitelist').insert({ id: uuidv4(), email, created_at: new Date(), created_by: 'seed' }).onConflict('email').ignore();
    await db('users').insert({ id: uuidv4(), email, totp_enabled: true, created_at: new Date() }).onConflict('email').ignore();
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(email, grantedAt, 'SYSTEM:seed', 'SYSTEM:seed');
    await db('admin_grants').insert({
      email, granted_at: grantedAt, granted_by_a: 'SYSTEM:seed', granted_by_b: 'SYSTEM:seed',
      signature_hex: sig,
    }).onConflict('email').ignore();
  }
  console.log(`  [+] ${imiEmails.length} bootstrap admins (re)signed`);

  // --- Block 14: Marketplace fixtures ---
  // Inserted directly (not via service) to avoid GitHub API calls during seeding.
  // The 10:00 UTC sync cron will populate description/stars/release/last_commit
  // automatically. Mix of statuses for UX richness.
  const MARKETPLACE_FIXTURES = [
    { url: 'https://github.com/datasharingframework/dsf-process-allow-list',  name: 'dsf-process-allow-list',  status: 'APPROVED' },
    { url: 'https://github.com/datasharingframework/dsf-process-feasibility', name: 'dsf-process-feasibility', status: 'APPROVED' },
    { url: 'https://github.com/datasharingframework/dsf-process-tutorial',    name: 'dsf-process-tutorial',    status: 'APPROVED' },
    { url: 'https://github.com/datasharingframework/dsf-process-hello-world', name: 'dsf-process-hello-world', status: 'EXPERIMENTAL' },
    { url: 'https://github.com/datasharingframework/dsf-process-ping-pong',   name: 'dsf-process-ping-pong',   status: 'EXPERIMENTAL' },
  ];
  for (const f of MARKETPLACE_FIXTURES) {
    await db('marketplace_entries').insert({
      id: uuidv4(),
      git_url: f.url,
      name: f.name,
      description: null,
      status: f.status,
      stars: 0,
      added_by: 'SYSTEM:seed',
      added_at: new Date(),
      updated_at: new Date(),
    }).onConflict('git_url').ignore();
  }
  console.log(`  [+] ${MARKETPLACE_FIXTURES.length} marketplace fixtures seeded`);

  // --- Block 15: CA blacklist fixtures ---
  // A mix of real-world distrusted CAs (Symantec/WoSign/Camerfirma/PROCERT)
  // plus one internal test CA so the picker / search UI has variety. Half
  // carry an SHA-256 fingerprint so the fingerprinted-vs-subject-only paths
  // both get exercised on the admin page.
  const CA_BLACKLIST = [
    {
      subject_dn: 'CN=Symantec Class 3 EV SSL CA - G3, O=Symantec Corporation, C=US',
      fingerprint: 'EB04CF5EB1F39AFA762F2BB120F296CBA520C1B97DB1589565B81CB9A17B7244',
      reason: 'Distrusted by Mozilla/Chrome (2018) — keine valide DSF-Kette',
    },
    {
      subject_dn: 'CN=WoSign CA Free SSL Certificate G2, O=WoSign CA Limited, C=CN',
      fingerprint: null,
      reason: 'WoSign/StartCom backdating incident — entire CA distrusted',
    },
    {
      subject_dn: 'CN=Test-CA, OU=Internal Dev, O=Acme Corp, C=DE',
      fingerprint: null,
      reason: 'Hausinternes Test-CA — nicht für Produktion zugelassen',
    },
    {
      subject_dn: 'CN=Camerfirma Chambers of Commerce Root, OU=http://www.chambersign.org, O=Camerfirma S.A., C=EU',
      fingerprint: '063E4AFAC491DFD332F3089B8542E94617D893D7FE944E10A7937EE29D9693C0',
      reason: 'Distrusted by Mozilla 2022 — multiple compliance failures',
    },
    {
      subject_dn: 'CN=PROCERT, O=Sistema Nacional de Certificacion Electronica, C=VE',
      fingerprint: null,
      reason: 'Distrusted by Mozilla/Apple 2017 — misissuance',
    },
    {
      subject_dn: 'CN=GeoTrust Universal CA 2, O=GeoTrust Inc., C=US',
      fingerprint: null,
      reason: 'Legacy CA — Symantec successor, distrusted along with Symantec roots',
    },
  ];
  for (const ca of CA_BLACKLIST) {
    await db('ca_blacklist').insert({
      id: uuidv4(),
      subject_dn: ca.subject_dn,
      fingerprint: ca.fingerprint,
      reason: ca.reason,
      added_by: 'SYSTEM:seed',
      added_at: pastDate(Math.floor(Math.random() * 30) + 1),
    }).onConflict('subject_dn').ignore();
  }
  console.log(`  [+] ${CA_BLACKLIST.length} CA-blacklist entries seeded`);

  // --- Block 16: Bundle-version history ---
  // Snapshot the current allow-list state three times with small DB mutations
  // between calls so the admin Diff view actually has content to render.
  // signBundle needs JWT_PRIVATE_KEY_BASE64 — if it's missing in this env we
  // log a warning instead of killing the seed.
  try {
    // Reset the orgs we're about to mutate so the seed stays idempotent across
    // re-runs (without this, "(umbenannt)" suffixes would accumulate).
    await db('organizations').where({ identifier: ORGS[0].identifier }).update({ active: true });
    await db('organizations').where({ identifier: ORGS[1].identifier }).update({ name: ORGS[1].name });

    const { createSnapshot } = await import('../services/bundle-versions.service');
    const approvedRows = await db('approval_requests')
      .where({ status: 'APPROVED' })
      .orderBy('resolved_at', 'asc')
      .limit(3);
    if (approvedRows.length < 3) {
      console.warn('  [!] fewer than 3 APPROVED requests — bundle-version block skipped');
    } else {
      const v1 = await createSnapshot({
        triggeredBy: 'APPROVAL', triggeredByEmail: ADMIN_EMAIL,
        approvalRequestId: approvedRows[0].id,
        notes: 'Initial baseline snapshot',
      });
      // Mutate: deactivate ORGS[0] so v2 differs by one removed org.
      await db('organizations').where({ identifier: ORGS[0].identifier }).update({ active: false });
      const v2 = await createSnapshot({
        triggeredBy: 'APPROVAL', triggeredByEmail: ADMIN_EMAIL,
        approvalRequestId: approvedRows[1].id,
        notes: `After deactivating ${ORGS[0].name}`,
      });
      // Mutate: reactivate ORGS[0], rename ORGS[1] so v3 differs again.
      await db('organizations').where({ identifier: ORGS[0].identifier }).update({ active: true });
      await db('organizations').where({ identifier: ORGS[1].identifier })
        .update({ name: `${ORGS[1].name} (umbenannt)` });
      const v3 = await createSnapshot({
        triggeredBy: 'APPROVAL', triggeredByEmail: ADMIN_EMAIL,
        approvalRequestId: approvedRows[2].id,
        notes: `After renaming ${ORGS[1].name}`,
      });
      console.log(`  [+] 3 bundle versions seeded (v${v1.versionNumber} → v${v2.versionNumber} → v${v3.versionNumber})`);
    }
  } catch (err) {
    console.warn('  [!] bundle-version seeding failed — JWT keys missing?', (err as Error).message);
  }

  console.log('\n--- Seed complete ---');
  console.log(`Login (admin):  ${ADMIN_EMAIL}`);
  console.log(`Login (member): ${MEMBER_EMAIL}`);
  console.log(`Login (site):   ${SITE_EMAIL}`);
  console.log(`Orgs: ${ORGS.length} + 1 member + 1 site | Contacts: ${contactCount} | Endpoints: ${endpointCount}`);

  await db.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
