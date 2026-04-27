/**
 * GeoMapCluster.tsx – Cluster pin for ≥2 sites sharing a city.
 * Slate border (NOT magenta — magenta is reserved for MII edges).
 * Count badge top-right; mini status dot bottom-right shows the
 * worst cert_status of any member (priority: EXPIRED > EXPIRING > NONE > VALID).
 */
import type { MapOrganization, MapClusterGroup } from '../../api/network.api';
import { cityBucketKey } from '../../lib/germanCities';

const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID:    '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED:  '#ef4444',
  NONE:     '#94a3b8',
};

const SLATE = '#475569';

interface Props {
  group: MapClusterGroup;
  x: number;
  y: number;
  isHovered: boolean;
  isSelected: boolean;
  matchedCount: number;       // ≤ group.members.length when filters trim members
  onSelect: (clusterKey: string) => void;
  onHover: (clusterKey: string | null) => void;
}

export function clusterKeyOf(group: MapClusterGroup): string {
  return `__cluster__${cityBucketKey(group.city, group.country_code)}`;
}

function cityInitials(city: string | null): string {
  return (city ?? '?').slice(0, 2).toUpperCase();
}

export function GeoMapCluster({ group, x, y, isHovered, isSelected, matchedCount, onSelect, onHover }: Props) {
  const r = isSelected ? 24 : isHovered ? 22 : 20;
  const initials = cityInitials(group.city);
  const key = clusterKeyOf(group);
  const worstColor = STATUS_COLOR[group.worstStatus];
  const total = group.members.length;
  const visible = matchedCount;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); onSelect(key); }}
      onMouseEnter={() => onHover(key)}
      onMouseLeave={() => onHover(null)}
    >
      {(isSelected || isHovered) && (
        <circle cx={x} cy={y} r={r + 6} fill={SLATE} opacity={isSelected ? 0.20 : 0.10} />
      )}
      <circle cx={x} cy={y} r={r} fill="#ffffff" stroke={SLATE} strokeWidth={isSelected ? 2.5 : 2} />
      <text
        x={x} y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        fill={SLATE}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {initials}
      </text>
      {/* Count badge top-right */}
      <circle cx={x + r * 0.7} cy={y - r * 0.7} r={9} fill={SLATE} />
      <text
        x={x + r * 0.7}
        y={y - r * 0.7}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#ffffff"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {visible < total ? `${visible}/${total}` : `${total}`}
      </text>
      {/* Worst-status mini-dot bottom-right */}
      <circle cx={x + r * 0.7} cy={y + r * 0.7} r={4} fill={worstColor} stroke="#ffffff" strokeWidth={1} />
    </g>
  );
}
