/**
 * peerEdges.ts – Derive membership-peer edges between map organizations.
 * Two orgs are peers iff they share at least one `parent_organization`.
 * The edge is labeled with that parent_organization (the "verbund").
 */
import type { MapOrganization } from '../api/network.api';

export interface PeerEdge {
  from: string;     // org.identifier
  to: string;       // org.identifier
  verbund: string;  // parent_organization
}

export function derivePeerEdges(orgs: MapOrganization[]): PeerEdge[] {
  // verbund -> identifiers of member orgs
  const byVerbund = new Map<string, string[]>();
  for (const o of orgs) {
    for (const m of o.memberships) {
      const list = byVerbund.get(m.parent_organization) ?? [];
      list.push(o.identifier);
      byVerbund.set(m.parent_organization, list);
    }
  }
  const edges: PeerEdge[] = [];
  for (const [verbund, members] of byVerbund) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        edges.push({ from: members[i], to: members[j], verbund });
      }
    }
  }
  return edges;
}
