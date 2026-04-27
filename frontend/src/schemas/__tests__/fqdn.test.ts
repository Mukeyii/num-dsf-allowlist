/**
 * fqdn.test.ts – Validates the relaxed FQDN regex used in organization/endpoint schemas.
 */
import { describe, it, expect } from 'vitest';
import { organizationSchema } from '../organization.schema';
import { endpointSchema } from '../endpoint.schema';

const ORG_BASE = { name: 'Org', active: true, email: 'a@b.de' };
const EP_BASE = { address: 'https://x.de/fhir', ipAddresses: [] };

function orgOk(id: string) {
  return organizationSchema.safeParse({ ...ORG_BASE, identifier: id }).success;
}
function epOk(id: string) {
  return endpointSchema.safeParse({ ...EP_BASE, identifier: id }).success;
}

describe('FQDN validation – organization.identifier', () => {
  it.each([
    'ukm.de',
    'dsf.ukm.de',
    'sub.dsf.ukm.de',
    'a-b.example.de',
    'host01.example.de',
    'UKM.de',
    'Sub-Domain.Example.Com',
    'xn--bcher-kva.example',
  ])('accepts %s', (id) => expect(orgOk(id)).toBe(true));

  it.each([
    '',
    'a',
    'no_underscores.de',
    'has spaces.de',
    'http://ukm.de',
    'ukm.de/path',
    'ukm.de:8443',
    '-leading-hyphen.de',
    'trailing-.de',
    '.startsdot.de',
  ])('rejects %s', (id) => expect(orgOk(id)).toBe(false));
});

describe('FQDN validation – endpoint.identifier', () => {
  it.each([
    'dsf-fhir.ukm.de',
    'fhir.sub.example.de',
    'Bpe.UKM.De',
  ])('accepts %s', (id) => expect(epOk(id)).toBe(true));

  it.each([
    'dsf-fhir.ukm.de:9000',
    'https://dsf-fhir.ukm.de',
    'foo bar.de',
  ])('rejects %s', (id) => expect(epOk(id)).toBe(false));
});
