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

const KNOWN_VERBUND_LABELS: Record<string, string> = {
  'mii-testverband.example.de': 'MII',
  'num-testverband.example.de': 'NUM',
};

const KNOWN_VERBUND_COLORS: Record<string, string> = {
  'mii-testverband.example.de': '#b01e66',
  'num-testverband.example.de': '#4a90d9',
};

export function verbundLabel(parentOrg: string): string {
  if (KNOWN_VERBUND_LABELS[parentOrg]) return KNOWN_VERBUND_LABELS[parentOrg];
  // Fallback: first label of the FQDN, uppercased.
  const first = parentOrg.split('.')[0] ?? parentOrg;
  return first.split('-')[0]?.toUpperCase() ?? parentOrg.toUpperCase();
}

export function verbundColor(parentOrg: string): string {
  return KNOWN_VERBUND_COLORS[parentOrg] ?? '#64748b';
}

export function verbundCounts(orgs: import('../api/network.api').MapOrganization[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of orgs) {
    const seen = new Set<string>();
    for (const m of o.memberships) {
      if (seen.has(m.parent_organization)) continue;
      seen.add(m.parent_organization);
      out.set(m.parent_organization, (out.get(m.parent_organization) ?? 0) + 1);
    }
  }
  return out;
}
