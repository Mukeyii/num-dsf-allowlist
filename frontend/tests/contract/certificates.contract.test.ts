import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';

// Self-signed RSA-1024/SHA-256 cert generated with node-forge.
// Subject CN=contract-test; valid through 2027-04-29.
// Regenerate with the snippet in the test docs if expired.
const TEST_PEM = `-----BEGIN CERTIFICATE-----
MIIBpDCCAQ2gAwIBAgIBATANBgkqhkiG9w0BAQsFADAYMRYwFAYDVQQDEw1jb250
cmFjdC10ZXN0MB4XDTI2MDQyOTIyMDk0MVoXDTI3MDQyOTIyMDk0MVowGDEWMBQG
A1UEAxMNY29udHJhY3QtdGVzdDCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEA
nPF/NerUsyEYwzZAdj8yN8yjn3/b+5kTKVXldgkRuL/H0YdYkyqbzYfhcDBi4Peq
JjuVdwzQZvr3edwg4Tin6Vap072YwevshuxI17Rr/hfDz0RYtbqxyfeuu3a2y8r3
VbbcPY05tJxTCaShIf6tZiSVeWIMlUqrSwiygKAosWkCAwEAATANBgkqhkiG9w0B
AQsFAAOBgQBWqsA+1igUpSXRUEh3qHh7WGGmQPnnY9gli6HR27cq2EYVj6/BeFI7
h1YHtGTDncsAEr74VolASGCF2dssSXNhTnxq6AV6iOFyWyRT2D/u9NvSdP9QdDd0
9dMuJcsMgBEgdnqtBdJYiFkgVRf7Uz1cON/BdP98fIr+9ajr5y0VtA==
-----END CERTIFICATE-----`;

describe('contract: POST /certificates accepts a valid PEM and round-trips', () => {
  let api: ContractClient;
  let instanceId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: `cert-host-${Date.now()}.example.de`,
      name: 'Host Org',
      email: 'host@x.de',
      active: true,
    });
  });

  it('persists the cert and exposes thumbprint + valid_until', async () => {
    const post = await api.post(`/api/v1/instances/${instanceId}/certificates`, { pem: TEST_PEM });
    expect(post.status).toBe(201);
    const cert = post.data.data;
    expect(typeof cert.id).toBe('string');
    expect(typeof cert.thumbprint).toBe('string');
    expect(cert.thumbprint.length).toBeGreaterThan(40);
    expect(typeof cert.valid_until).toBe('string');
  });
});
