/**
 * bundle-versions.service.test.ts – Targeted test for diffVersions with
 * known content. We insert two bundle_versions rows directly (so we control
 * bundle_json exactly, instead of relying on generateFullBundle): version A
 * holds one Organization entry; version B holds that same entry plus a second
 * one, AND a changed Endpoint entry. The diff (A → B) must report exactly the
 * added / removed / changed counts.
 *
 * diffVersions(idA, idB): added = in B not in A, removed = in A not in B,
 * changed = same key but different JSON. Entries are keyed by
 * `resourceType + '/' + id`.
 *
 * Dependencies: db/connection, bundle-versions.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { diffVersions } from '../services/bundle-versions.service';

function entry(resourceType: string, id: string, extra: Record<string, unknown> = {}) {
  return { resource: { resourceType, id, ...extra } };
}

describe('bundle-versions.service – diffVersions', () => {
  const idA = uuidv4();
  const idB = uuidv4();
  const email = `bv-svc-${Date.now()}@example.de`;

  const bundleA = {
    resourceType: 'Bundle',
    entry: [
      entry('Organization', 'org-1', { name: 'Alpha' }),
      entry('Endpoint', 'ep-1', { address: 'https://old.example/fhir' }),
    ],
  };
  // B: org-1 unchanged, org-2 ADDED, ep-1 CHANGED (address differs).
  const bundleB = {
    resourceType: 'Bundle',
    entry: [
      entry('Organization', 'org-1', { name: 'Alpha' }),
      entry('Organization', 'org-2', { name: 'Beta' }),
      entry('Endpoint', 'ep-1', { address: 'https://new.example/fhir' }),
    ],
  };

  beforeAll(async () => {
    await db('bundle_versions').insert([
      {
        id: idA, triggered_by: 'MANUAL', triggered_by_email: email,
        content_hash: 'a'.repeat(64), signature: 'sig-a',
        bundle_json: JSON.stringify(bundleA),
      },
      {
        id: idB, triggered_by: 'MANUAL', triggered_by_email: email,
        content_hash: 'b'.repeat(64), signature: 'sig-b',
        bundle_json: JSON.stringify(bundleB),
      },
    ]);
  });

  afterAll(async () => {
    await db('bundle_versions').whereIn('id', [idA, idB]).del();
  });

  it('reports the added, removed and changed entries for A → B', async () => {
    const diff = await diffVersions(idA, idB);

    // org-2 is new in B.
    expect(diff.added.length).toBe(1);
    expect(diff.added[0].resource?.id).toBe('org-2');

    // nothing was deleted between A and B.
    expect(diff.removed.length).toBe(0);

    // ep-1 changed its address.
    expect(diff.changed.length).toBe(1);
    expect(diff.changed[0].before.resource?.id).toBe('ep-1');
    expect(diff.changed[0].after.resource?.id).toBe('ep-1');
    expect(diff.changed[0].before).not.toEqual(diff.changed[0].after);
  });

  it('reports the inverse (removed instead of added) for B → A', async () => {
    const diff = await diffVersions(idB, idA);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].resource?.id).toBe('org-2');
    expect(diff.changed.length).toBe(1);
  });
});
