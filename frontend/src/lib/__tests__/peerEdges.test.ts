/**
 * peerEdges.test.ts – Unit tests for membership-peer edge derivation
 */
import { describe, it, expect } from 'vitest';
import { derivePeerEdges } from '../peerEdges';
import type { MapOrganization } from '../../api/network.api';

function org(identifier: string, parents: string[]): MapOrganization {
  return {
    identifier,
    name: identifier,
    active: true,
    city: 'Berlin',
    country_code: 'DE',
    cert_status: 'VALID',
    endpoints: [],
    memberships: parents.map(p => ({ parent_organization: p, roles: [] })),
  };
}

describe('derivePeerEdges', () => {
  it('returns no edges for orgs with no shared parent', () => {
    const orgs = [org('a', ['mii']), org('b', ['num'])];
    expect(derivePeerEdges(orgs)).toEqual([]);
  });

  it('returns one edge for two orgs sharing one parent', () => {
    const edges = derivePeerEdges([org('a', ['mii']), org('b', ['mii'])]);
    expect(edges).toHaveLength(1);
    expect(edges[0].verbund).toBe('mii');
    const ids = [edges[0].from, edges[0].to].sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('returns one edge per shared parent for two orgs in two verbunds', () => {
    const edges = derivePeerEdges([
      org('a', ['mii', 'num']),
      org('b', ['mii', 'num']),
    ]);
    expect(edges).toHaveLength(2);
    const verbunds = edges.map(e => e.verbund).sort();
    expect(verbunds).toEqual(['mii', 'num']);
  });

  it('does not duplicate or self-loop', () => {
    const orgs = [org('a', ['mii']), org('b', ['mii']), org('c', ['mii'])];
    const edges = derivePeerEdges(orgs);
    expect(edges).toHaveLength(3); // a-b, a-c, b-c
    for (const e of edges) expect(e.from).not.toBe(e.to);
    const pairs = new Set(edges.map(e => [e.from, e.to].sort().join('|')));
    expect(pairs.size).toBe(3);
  });

  it('handles orgs with no memberships', () => {
    expect(derivePeerEdges([org('a', []), org('b', [])])).toEqual([]);
  });
});
