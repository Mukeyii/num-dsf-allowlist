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

const USER_ID = uuidv4();
const ADMIN_EMAIL = 'admin@imi-test.example.de';

const GREEK = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'My', 'Ny', 'Xi', 'Omikron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Ypsilon', 'Phi', 'Chi', 'Psi', 'Omega',
  'Astra', 'Nova', 'Orion', 'Vega', 'Lyra', 'Rigel',
];

const ORG_TYPES = ['Klinikum', 'Universitätsklinik', 'Kreiskrankenhaus', 'Stadtklinik', 'Forschungsklinik'];
const CITIES = [
  'Musterstadt', 'Beispielburg', 'Testingen', 'Probenhausen', 'Demohausen',
  'Fiktivstadt', 'Platzhalterburg', 'Dummyheim', 'Samplehausen', 'Mockstadt',
  'Nordlingen', 'Südburg', 'Westheim', 'Oststadt', 'Mittendorf',
  'Oberhagen', 'Unterdorf', 'Altstadt', 'Neuburg', 'Hochheim',
  'Tiefental', 'Breitenfeld', 'Langenstein', 'Rundheim', 'Eckstadt',
  'Grünberg', 'Blaustadt', 'Rotheim', 'Weissburg', 'Goldbach',
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
  return (hex + 'abcdef0123456789').repeat(8).slice(0, 128);
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
  await db('audit_logs').where('user_email', ADMIN_EMAIL).del();
  await db('approval_requests').whereIn('instance_id',
    db('instances').select('id').where('user_id', USER_ID)).del();
  await db('instances').where('user_id', USER_ID).del();
  await db('users').where('email', ADMIN_EMAIL).del();
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

  // 4. Create organizations
  for (const org of ORGS) {
    await db('organizations').insert({
      identifier: org.identifier, instance_id: org.instanceId,
      name: org.name, active: true, email: org.email,
      address_line: org.addressLine, postal_code: org.postalCode,
      city: org.city, country_code: org.countryCode,
      created_at: new Date(), updated_at: new Date(),
    }).onConflict('identifier').ignore();
  }
  console.log(`  [+] ${ORGS.length} organizations`);

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

  // 7. Certificates (1 per org, varied expiry)
  const EXPIRY_DAYS = [730, 365, 180, 90, 30, 7];
  for (let i = 0; i < ORGS.length; i++) {
    await db('certificates').insert({
      id: uuidv4(),
      organization_id: ORGS[i].identifier,
      pem: FAKE_PEM,
      subject: `CN=dsf-fhir.${ORGS[i].identifier}`,
      thumbprint: thumbprint(i),
      valid_until: futureDate(EXPIRY_DAYS[i % EXPIRY_DAYS.length]),
      created_at: new Date(),
    });
  }
  console.log(`  [+] ${ORGS.length} certificates`);

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

  // 9. Approval requests (mix of statuses)
  const approvals = [
    { instanceIdx: 0, status: 'APPROVED', daysAgo: 60 },
    { instanceIdx: 5, status: 'APPROVED', daysAgo: 30 },
    { instanceIdx: 1, status: 'PENDING', daysAgo: 3 },
    { instanceIdx: 10, status: 'PENDING', daysAgo: 1 },
    { instanceIdx: 15, status: 'REJECTED', daysAgo: 14 },
  ];
  for (const a of approvals) {
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: INSTANCES[a.instanceIdx].id,
      status: a.status,
      created_at: pastDate(a.daysAgo),
      submitted_at: pastDate(a.daysAgo),
      resolved_at: a.status !== 'PENDING' ? pastDate(a.daysAgo - 1) : null,
      resolved_by: a.status !== 'PENDING' ? ADMIN_EMAIL : null,
      comment: a.status === 'REJECTED' ? 'Zertifikat abgelaufen, bitte erneuern.' : null,
      snapshot_json: JSON.stringify({ note: `Test ${a.status}` }),
    });
  }
  console.log(`  [+] ${approvals.length} approval requests`);

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

  console.log('\n--- Seed complete ---');
  console.log(`Login: ${ADMIN_EMAIL}`);
  console.log(`Orgs: ${ORGS.length} | Contacts: ${contactCount} | Endpoints: ${endpointCount}`);

  await db.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
