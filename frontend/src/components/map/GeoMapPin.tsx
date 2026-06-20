/**
 * GeoMapPin.tsx – Single-org pin on the geographic map.
 * Border encodes cert_status; dashed border + transparent fill encodes
 * inactive. Initials inside use the same status color.
 */
import type { MapOrganization } from '../../api/network.api';

const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID: '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED: '#ef4444',
  NONE: '#94a3b8',
};

interface Props {
  org: MapOrganization;
  x: number;
  y: number;
  isHovered: boolean;
  isSelected: boolean;
  isUnknown: boolean; // true when city falls back to Sonstige stripe
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function initialsOf(org: MapOrganization): string {
  return (org.name || org.identifier)
    .split(/[\s\-.]+/)
    .slice(0, 2)
    .map((s) => s[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function GeoMapPin({
  org,
  x,
  y,
  isHovered,
  isSelected,
  isUnknown,
  onSelect,
  onHover,
}: Props) {
  const color = STATUS_COLOR[org.cert_status];
  const isInactive = !org.active;
  const r = isSelected ? 18 : isHovered ? 16 : 14;
  const strokeWidth = isSelected ? 2.5 : 2;
  const initials = initialsOf(org);
  const initialsColor = isInactive ? '#94a3b8' : color;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={org.name || org.identifier}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(org.identifier);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(org.identifier);
        }
      }}
      onMouseEnter={() => onHover(org.identifier)}
      onMouseLeave={() => onHover(null)}
    >
      {(isSelected || isHovered) && (
        <circle cx={x} cy={y} r={r + 6} fill={color} opacity={isSelected ? 0.25 : 0.12} />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={isInactive ? 'none' : '#ffffff'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={isInactive ? '3 2' : undefined}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        fill={initialsColor}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {initials}
      </text>
      {isUnknown && (
        <text
          x={x + r - 1}
          y={y - r + 4}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="#94a3b8"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          ?
        </text>
      )}
    </g>
  );
}
