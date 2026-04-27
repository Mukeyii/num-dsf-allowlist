/**
 * GeoMap.tsx – Top-level SVG of the network map.
 * Buckets pins by (city, country_code). Single-site cities render as a
 * GeoMapPin; multi-site cities collapse into a GeoMapCluster.
 *
 * Dependencies: GermanyOutline, GeoMapPin, GeoMapCluster, germanCities,
 *               peerEdges (later), useI18n, network.api types.
 */
import { useMemo, useState } from 'react';
import type { MapOrganization, MapClusterGroup } from '../../api/network.api';
import { GermanyOutline } from './GermanyOutline';
import { GeoMapPin } from './GeoMapPin';
import { GeoMapCluster, clusterKeyOf } from './GeoMapCluster';
import { GeoMapEdges } from './GeoMapEdges';
import type { PeerEdge } from '../../lib/peerEdges';
import { getPinCoord, cityBucketKey } from '../../lib/germanCities';
import { useI18n } from '../../stores/i18n.store';

interface Props {
  organizations: MapOrganization[];           // already filtered (search/status/active)
  allOrganizations: MapOrganization[];        // unfiltered, used for cluster total counts
  selectedId: string | null;                  // pin identifier OR cluster key
  onSelect: (id: string | null) => void;
  edges: PeerEdge[];
  activeVerbunds: Set<string>;
  showAllEdges: boolean;
}

interface PlacedPin {
  kind: 'pin';
  org: MapOrganization;
  x: number;
  y: number;
  known: boolean;
}
interface PlacedCluster {
  kind: 'cluster';
  group: MapClusterGroup;       // visible-only members
  totalMembers: number;         // unfiltered count
  x: number;
  y: number;
}
type Placed = PlacedPin | PlacedCluster;

const STATUS_PRIORITY: Record<MapOrganization['cert_status'], number> = {
  EXPIRED: 4, EXPIRING: 3, NONE: 2, VALID: 1,
};

function worstStatus(orgs: MapOrganization[]): MapOrganization['cert_status'] {
  let worst: MapOrganization['cert_status'] = 'VALID';
  for (const o of orgs) {
    if (STATUS_PRIORITY[o.cert_status] > STATUS_PRIORITY[worst]) worst = o.cert_status;
  }
  return worst;
}

function bucketByCity(orgs: MapOrganization[]): Map<string, MapOrganization[]> {
  const buckets = new Map<string, MapOrganization[]>();
  for (const o of orgs) {
    const key = cityBucketKey(o.city, o.country_code);
    const list = buckets.get(key) ?? [];
    list.push(o);
    buckets.set(key, list);
  }
  return buckets;
}

export function GeoMap({
  organizations, allOrganizations, selectedId, onSelect,
  edges, activeVerbunds, showAllEdges,
}: Props) {
  const { t } = useI18n();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onMapVisible = useMemo(
    () => organizations.filter(o => (o.country_code ?? 'DE') === 'DE'),
    [organizations],
  );
  const onMapAll = useMemo(
    () => allOrganizations.filter(o => (o.country_code ?? 'DE') === 'DE'),
    [allOrganizations],
  );

  const placed = useMemo<Placed[]>(() => {
    const visibleBuckets = bucketByCity(onMapVisible);
    const totalBuckets = bucketByCity(onMapAll);
    const out: Placed[] = [];
    for (const [bucketKey, members] of visibleBuckets) {
      const totalMembers = (totalBuckets.get(bucketKey) ?? members).length;
      // Use the first member to get the city/coord (all members in a bucket share city).
      const first = members[0];
      const { coord } = getPinCoord(first.city);
      if (totalMembers >= 2) {
        const group: MapClusterGroup = {
          city: first.city,
          country_code: first.country_code,
          members,
          worstStatus: worstStatus(members),
        };
        out.push({ kind: 'cluster', group, totalMembers, x: coord[0], y: coord[1] });
      } else {
        const { known } = getPinCoord(first.city);
        out.push({ kind: 'pin', org: first, x: coord[0], y: coord[1], known });
      }
    }
    return out;
  }, [onMapVisible, onMapAll]);

  const endpointPos = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const p of placed) {
      if (p.kind === 'pin') m.set(p.org.identifier, [p.x, p.y]);
      else for (const member of p.group.members) m.set(member.identifier, [p.x, p.y]);
    }
    return m;
  }, [placed]);

  const clusterKeyForOrg = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of placed) if (p.kind === 'cluster') {
      const k = clusterKeyOf(p.group);
      for (const member of p.group.members) m.set(member.identifier, k);
    }
    return (orgId: string) => m.get(orgId) ?? null;
  }, [placed]);

  if (organizations.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '14px',
      }}>
        {t('mapEmptyState')}
      </div>
    );
  }

  const tooltipTarget: Placed | null = (() => {
    const id = selectedId ?? hoveredId;
    if (!id) return null;
    for (const p of placed) {
      if (p.kind === 'pin' && p.org.identifier === id) return p;
      if (p.kind === 'cluster' && clusterKeyOf(p.group) === id) return p;
    }
    return null;
  })();

  return (
    <svg
      viewBox="0 0 600 760"
      style={{ width: '100%', height: '100%', display: 'block' }}
      onClick={() => onSelect(null)}
    >
      <rect width="600" height="760" fill="#f8fafc" />
      <GermanyOutline />

      <rect x="540" y="120" width="40" height="580" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 3" />
      <text x="560" y="115" textAnchor="middle" fontSize="9" fill="#94a3b8">{t('mapSonstigeLabel')}</text>

      <GeoMapEdges
        edges={edges}
        endpointPos={endpointPos}
        selectedId={selectedId}
        hoveredId={hoveredId}
        activeVerbunds={activeVerbunds}
        showAllEdges={showAllEdges}
        clusterKeyForOrg={clusterKeyForOrg}
      />

      {placed.map(p => p.kind === 'pin' ? (
        <GeoMapPin
          key={p.org.identifier}
          org={p.org} x={p.x} y={p.y}
          isHovered={hoveredId === p.org.identifier}
          isSelected={selectedId === p.org.identifier}
          isUnknown={!p.known}
          onSelect={onSelect}
          onHover={setHoveredId}
        />
      ) : (
        <GeoMapCluster
          key={clusterKeyOf(p.group)}
          group={p.group}
          x={p.x} y={p.y}
          isHovered={hoveredId === clusterKeyOf(p.group)}
          isSelected={selectedId === clusterKeyOf(p.group)}
          matchedCount={p.group.members.length}
          onSelect={onSelect}
          onHover={setHoveredId}
        />
      ))}

      {tooltipTarget && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={tooltipTarget.x - 90}
            y={tooltipTarget.y - 50}
            width={180} height={36} rx={8}
            fill="#0f172a" opacity={0.92}
          />
          {tooltipTarget.kind === 'pin' ? (
            <>
              <text x={tooltipTarget.x} y={tooltipTarget.y - 35}
                    textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
                {tooltipTarget.org.name}
              </text>
              <text x={tooltipTarget.x} y={tooltipTarget.y - 22}
                    textAnchor="middle" fontSize={9} fill="#cbd5e1">
                {tooltipTarget.org.city ?? '—'} {tooltipTarget.org.country_code ? `· ${tooltipTarget.org.country_code}` : ''}
              </text>
            </>
          ) : (
            <>
              <text x={tooltipTarget.x} y={tooltipTarget.y - 35}
                    textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
                {tooltipTarget.group.city ?? '?'}
              </text>
              <text x={tooltipTarget.x} y={tooltipTarget.y - 22}
                    textAnchor="middle" fontSize={9} fill="#cbd5e1">
                {t('mapClusterCity', { n: tooltipTarget.totalMembers, city: tooltipTarget.group.city ?? '?' })}
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  );
}
