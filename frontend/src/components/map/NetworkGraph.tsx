/**
 * NetworkGraph.tsx – SVG radial node graph of the P2P allow list
 * Each org = a circle node, colored by cert validity.
 * Edges = parent_organization memberships between displayed orgs.
 * Dependencies: react
 */
import { useMemo, useState } from 'react';
import type { MapOrganization } from '../../api/network.api';

const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID:    '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED:  '#ef4444',
  NONE:     '#94a3b8',
};

interface Props {
  organizations: MapOrganization[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function NetworkGraph({ organizations, selectedId, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const layout = useMemo(() => {
    const n = Math.max(organizations.length, 1);
    const cx = 500, cy = 380;
    const baseR = 260;
    return organizations.map((org, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const radius = baseR + Math.min((org.endpoints.length || 0) * 6, 40);
      return { org, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
  }, [organizations]);

  const positionById = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const { org, x, y } of layout) map.set(org.identifier, { x, y });
    return map;
  }, [layout]);

  const edges = useMemo(() => {
    const lines: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const { org } of layout) {
      for (const m of org.memberships) {
        const target = positionById.get(m.parent_organization);
        const source = positionById.get(org.identifier);
        if (target && source) {
          lines.push({
            from: org.identifier, to: m.parent_organization,
            x1: source.x, y1: source.y, x2: target.x, y2: target.y,
          });
        }
      }
    }
    return lines;
  }, [layout, positionById]);

  if (organizations.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '14px',
      }}>
        No approved organizations in the allow list yet.
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 1000 760"
      style={{ width: '100%', height: '100%', display: 'block' }}
      onClick={() => onSelect(null)}
    >
      <defs>
        <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#fff5fa" />
          <stop offset="100%" stopColor="#f8fafc" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="1000" height="760" fill="url(#bg-grad)" />

      {edges.map((e, i) => (
        <line
          key={`e-${i}`}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#cbd5e1" strokeWidth={1.2} strokeDasharray="4 3"
          opacity={selectedId && (selectedId === e.from || selectedId === e.to) ? 1 : 0.5}
        />
      ))}

      <text x={500} y={385} textAnchor="middle" fontSize={13} fontWeight={700} fill="#b01e66" letterSpacing="0.12em">
        DSF ALLOW LIST
      </text>
      <text x={500} y={405} textAnchor="middle" fontSize={11} fill="#94a3b8">
        {organizations.length} active organization{organizations.length === 1 ? '' : 's'}
      </text>

      {layout.map(({ org, x, y }) => {
        const isSelected = selectedId === org.identifier;
        const isHovered  = hoveredId === org.identifier;
        const color = STATUS_COLOR[org.cert_status];
        const baseSize = 22 + Math.min(org.endpoints.length * 2, 10);
        const r = isSelected ? baseSize + 6 : isHovered ? baseSize + 3 : baseSize;
        const initials = (org.name || org.identifier)
          .split(/[\s\-.]+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase().slice(0, 2);
        return (
          <g
            key={org.identifier}
            style={{ cursor: 'pointer', transition: 'transform 0.15s' }}
            onClick={e => { e.stopPropagation(); onSelect(org.identifier); }}
            onMouseEnter={() => setHoveredId(org.identifier)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <circle cx={x} cy={y} r={r + 6} fill={color} opacity={isSelected ? 0.25 : 0.12} />
            <circle
              cx={x} cy={y} r={r}
              fill="#ffffff" stroke={color} strokeWidth={isSelected ? 3 : 2}
              filter={isSelected ? 'url(#glow)' : undefined}
            />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>
              {initials}
            </text>
            {(isHovered || isSelected) && (
              <g>
                <rect
                  x={x - 80} y={y + r + 8} width={160} height={34} rx={8}
                  fill="#0f172a" opacity={0.92}
                />
                <text x={x} y={y + r + 22} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
                  {org.name}
                </text>
                <text x={x} y={y + r + 34} textAnchor="middle" fontSize={9} fill="#cbd5e1">
                  {org.city ?? ''} {org.country_code ? `· ${org.country_code}` : ''}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
