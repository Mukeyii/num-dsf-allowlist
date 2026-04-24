/**
 * NetworkGraph.tsx – SVG sunflower graph of the P2P allow list
 * Nodes placed on a golden-angle Fermat spiral so layout scales past 50+ orgs.
 * Each org = a circle colored by cert validity with a `local_hospital` glyph.
 * Edges = parent_organization memberships between displayed orgs.
 * Tooltip for hovered-or-selected node is rendered in a dedicated layer AFTER
 * all nodes so it never sits behind another circle.
 * Dependencies: react
 */
import { useMemo, useState } from 'react';
import type { MapOrganization } from '../../api/network.api';
import { useI18n } from '../../stores/i18n.store';

const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID:    '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED:  '#ef4444',
  NONE:     '#94a3b8',
};

// Archimedean spiral with a fixed number of nodes per turn so the arms are
// visually recognizable (not just a sunflower cloud). Radial step per node
// adapts to n so the outer radius fits the viewBox.
const SPIRAL_START_R = 80;
const SPIRAL_MAX_R = 340;
const SPIRAL_MAX_STEP_OUT = 12;          // pixels radial per node at small n
const SPIRAL_MIN_RADIAL_PER_TURN = 55;   // keeps consecutive turns from overlapping node diameters
const SPIRAL_MIN_NODES_PER_TURN = 10;

interface Props {
  organizations: MapOrganization[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface LayoutEntry {
  org: MapOrganization;
  x: number;
  y: number;
  baseSize: number;
}

export function NetworkGraph({ organizations, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const layout = useMemo<LayoutEntry[]>(() => {
    const cx = 500, cy = 380;
    const n = organizations.length;
    const stepOut = Math.min(
      SPIRAL_MAX_STEP_OUT,
      (SPIRAL_MAX_R - SPIRAL_START_R) / Math.max(n - 1, 1),
    );
    const nodesPerTurn = Math.max(
      SPIRAL_MIN_NODES_PER_TURN,
      Math.ceil(SPIRAL_MIN_RADIAL_PER_TURN / stepOut),
    );
    const angleStep = (2 * Math.PI) / nodesPerTurn;
    // Sort by identifier so each org's slot on the spiral is stable across refetches.
    const sorted = [...organizations].sort((a, b) => a.identifier.localeCompare(b.identifier));
    return sorted.map((org, i) => {
      const theta = i * angleStep;
      const r = SPIRAL_START_R + i * stepOut;
      const baseSize = 22 + Math.min(org.endpoints.length * 2, 10);
      return {
        org,
        x: cx + r * Math.cos(theta),
        y: cy + r * Math.sin(theta),
        baseSize,
      };
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
        {t('mapEmptyState')}
      </div>
    );
  }

  // Tooltip target: selected takes precedence over hovered (selection is persistent).
  const tooltipTarget: (LayoutEntry & { nodeR: number }) | null = (() => {
    const id = selectedId ?? hoveredId;
    if (!id) return null;
    const entry = layout.find(l => l.org.identifier === id);
    if (!entry) return null;
    const isSelected = selectedId === entry.org.identifier;
    const isHovered  = hoveredId  === entry.org.identifier;
    const nodeR = isSelected ? entry.baseSize + 6 : isHovered ? entry.baseSize + 3 : entry.baseSize;
    return { ...entry, nodeR };
  })();

  return (
    <svg
      viewBox="0 0 1000 760"
      style={{ width: '100%', height: '100%', display: 'block' }}
      onClick={() => onSelect(null)}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Unified flat background */}
      <rect width="1000" height="760" fill="#f8fafc" />

      {/* Edges (drawn first so circles sit on top) */}
      {edges.map((e, i) => (
        <line
          key={`e-${i}`}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#cbd5e1" strokeWidth={1.2} strokeDasharray="4 3"
          opacity={selectedId && (selectedId === e.from || selectedId === e.to) ? 1 : 0.5}
        />
      ))}

      {/* Central label */}
      <text x={500} y={385} textAnchor="middle" fontSize={13} fontWeight={700} fill="#b01e66" letterSpacing="0.12em">
        {t('mapCentralTitle')}
      </text>
      <text x={500} y={405} textAnchor="middle" fontSize={11} fill="#94a3b8">
        {organizations.length} {organizations.length === 1 ? t('mapCentralSubtitleOne') : t('mapCentralSubtitleMany')}
      </text>

      {/* Nodes (circles + icon). Tooltip rendered separately below so it's always on top. */}
      {layout.map(({ org, x, y, baseSize }) => {
        const isSelected = selectedId === org.identifier;
        const isHovered  = hoveredId === org.identifier;
        const color = STATUS_COLOR[org.cert_status];
        const nodeR = isSelected ? baseSize + 6 : isHovered ? baseSize + 3 : baseSize;
        return (
          <g
            key={org.identifier}
            style={{ cursor: 'pointer', transition: 'transform 0.15s' }}
            onClick={e => { e.stopPropagation(); onSelect(org.identifier); }}
            onMouseEnter={() => setHoveredId(org.identifier)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <circle cx={x} cy={y} r={nodeR + 6} fill={color} opacity={isSelected ? 0.25 : 0.12} />
            <circle
              cx={x} cy={y} r={nodeR}
              fill="#ffffff" stroke={color} strokeWidth={isSelected ? 3 : 2}
              filter={isSelected ? 'url(#glow)' : undefined}
            />
            <foreignObject
              x={x - nodeR} y={y - nodeR}
              width={nodeR * 2} height={nodeR * 2}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%',
              }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: `${Math.round(nodeR * 0.85)}px`,
                    color: '#475569',
                    lineHeight: 1,
                    fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
                  }}
                >
                  corporate_fare
                </span>
              </div>
            </foreignObject>
          </g>
        );
      })}

      {/* Tooltip layer — rendered AFTER all nodes so it is never occluded */}
      {tooltipTarget && (
        <g key="tooltip-layer" style={{ pointerEvents: 'none' }}>
          <rect
            x={tooltipTarget.x - 80} y={tooltipTarget.y + tooltipTarget.nodeR + 8}
            width={160} height={34} rx={8}
            fill="#0f172a" opacity={0.92}
          />
          <text
            x={tooltipTarget.x} y={tooltipTarget.y + tooltipTarget.nodeR + 22}
            textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff"
          >
            {tooltipTarget.org.name}
          </text>
          <text
            x={tooltipTarget.x} y={tooltipTarget.y + tooltipTarget.nodeR + 34}
            textAnchor="middle" fontSize={9} fill="#cbd5e1"
          >
            {tooltipTarget.org.city ?? ''} {tooltipTarget.org.country_code ? `· ${tooltipTarget.org.country_code}` : ''}
          </text>
        </g>
      )}
    </svg>
  );
}
