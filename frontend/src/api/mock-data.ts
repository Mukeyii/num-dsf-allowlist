/**
 * mock-data.ts — Static mock data for GitHub Pages demo mode
 * Dependencies: none (pure data, no imports)
 */

const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'My', 'Ny', 'Xi', 'Omikron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Ypsilon', 'Phi', 'Chi', 'Psi', 'Omega',
  'Astra', 'Nova', 'Orion', 'Vega', 'Lyra', 'Rigel'];

const ORG_TYPES = ['Klinikum', 'Universitätsklinik', 'Kreiskrankenhaus', 'Stadtklinik', 'Forschungsklinik'];

function slug(name: string): string {
  return name.toLowerCase()
    .replace(/[äöüß]/g, c => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' } as Record<string, string>)[c] || c)
    .replace(/\s+/g, '-');
}

function futureDate(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pastDate(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString();
}

function uuid(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
}

const instances = GREEK.map((name, i) => ({
  id: uuid(100 + i),
  label: `${ORG_TYPES[i % ORG_TYPES.length]} ${name}`,
  user_id: uuid(1),
}));

const organizations = GREEK.map((name, i) => {
  const orgType = ORG_TYPES[i % ORG_TYPES.length];
  const domain = `${slug(orgType)}-${name.toLowerCase()}.example.de`;
  return {
    identifier: domain,
    instance_id: instances[i].id,
    name: `${orgType} ${name}`,
    active: true,
    email: `dsf-admin@${domain}`,
    address_line: `Musterstr. ${(i + 1) * 10}`,
    postal_code: String(10000 + i * 1111).slice(0, 5),
    city: `Stadt ${name}`,
    country_code: 'DE',
  };
});

const CONTACT_TYPES = [['MEDIC'], ['DSF_ADMIN'], ['SECURITY'], ['MEDIC', 'DSF_ADMIN'], ['DSF_ADMIN', 'SECURITY']];
const FIRST = ['Max', 'Anna', 'Felix', 'Julia', 'Markus', 'Sophie', 'Thomas', 'Elena', 'Peter', 'Claudia'];
const LAST = ['Mustermann', 'Musterfrau', 'Testperson', 'Beispiel', 'Platzhalter', 'Dummy', 'Probst', 'Fiktiv', 'Demo', 'Sample'];

const contacts = organizations.flatMap((org, i) => [0, 1].map(j => ({
  id: uuid(200 + i * 2 + j),
  organization_id: org.identifier,
  types: JSON.stringify(CONTACT_TYPES[(i * 2 + j) % CONTACT_TYPES.length]),
  name: `Dr. ${FIRST[(i * 2 + j) % FIRST.length]} ${LAST[(i * 2 + j) % LAST.length]}`,
  email: `${FIRST[(i * 2 + j) % FIRST.length].toLowerCase()}@${org.identifier}`,
  email_validated: j === 0,
  phone: `+4930${String(1000000 + i * 10000 + j)}`,
})));

const endpoints = organizations.map((org, i) => ({
  identifier: `dsf-fhir.${org.identifier}`,
  organization_id: org.identifier,
  name: `DSF FHIR ${GREEK[i]}`,
  address: `https://dsf-fhir.${org.identifier}/fhir`,
  ipAddresses: [
    { id: uuid(400 + i * 2), ip: `192.0.2.${i + 1}`, isFhir: true, isBpe: false },
    { id: uuid(400 + i * 2 + 1), ip: `198.51.100.${i + 1}`, isFhir: false, isBpe: true },
  ],
}));

const EXPIRY = [730, 365, 180, 90, 30, 7];
const certificates = organizations.map((org, i) => ({
  id: uuid(500 + i),
  organization_id: org.identifier,
  subject: `CN=dsf-fhir.${org.identifier}`,
  thumbprint: `${String(i).padStart(2, '0')}abcdef`.repeat(16).slice(0, 128),
  valid_until: futureDate(EXPIRY[i % EXPIRY.length]),
}));

const PARENT_ORGS = ['mii-testverband.example.de', 'num-testverband.example.de'];
const ROLES = [['DIC'], ['DMS'], ['HRP'], ['DIC', 'HRP'], ['DIC', 'DMS']];
const memberships = organizations.map((org, i) => ({
  id: uuid(600 + i),
  organization_id: org.identifier,
  parent_organization: PARENT_ORGS[i % 2],
  endpoint_id: `dsf-fhir.${org.identifier}`,
  roles: JSON.stringify(ROLES[i % ROLES.length]),
}));

const approvalHistory = [
  { id: uuid(700), instance_id: instances[0].id, status: 'APPROVED', created_at: pastDate(60), submitted_at: pastDate(60), resolved_at: pastDate(59), resolved_by: 'admin@imi-test.example.de', comment: null },
  { id: uuid(701), instance_id: instances[0].id, status: 'PENDING', created_at: pastDate(2), submitted_at: pastDate(2), resolved_at: null, resolved_by: null, comment: null },
  { id: uuid(702), instance_id: instances[5].id, status: 'REJECTED', created_at: pastDate(14), submitted_at: pastDate(14), resolved_at: pastDate(13), resolved_by: 'admin@imi-test.example.de', comment: 'Zertifikat abgelaufen' },
];

const auditLogs = Array.from({ length: 10 }, (_, i) => ({
  id: uuid(800 + i),
  timestamp: pastDate(i * 3),
  user_email: 'admin@imi-test.example.de',
  instance_id: instances[i % instances.length].id,
  resource_type: (['AUTH', 'ORGANIZATION', 'CONTACT', 'ENDPOINT', 'CERTIFICATE', 'MEMBERSHIP', 'APPROVAL', 'AUTH', 'ORGANIZATION', 'CONTACT'] as const)[i],
  resource_id: uuid(900 + i),
  operation: (['LOGIN', 'CREATE', 'CREATE', 'CREATE', 'CREATE', 'CREATE', 'APPROVE', 'LOGOUT', 'UPDATE', 'DELETE'] as const)[i],
  ip_address: '198.51.100.1',
}));

export const mockData = {
  instances,
  organizations,
  contacts,
  endpoints,
  certificates,
  memberships,
  approvalHistory,
  auditLogs,
  user: { id: uuid(1), email: 'demo@imi-test.example.de' },
};
