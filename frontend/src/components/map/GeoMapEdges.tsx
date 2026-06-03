/**
 * GeoMapEdges.tsx – SVG layer rendering peer edges as quadratic Beziers.
 * Layer is `pointer-events: none` so it never steals hover/click from pins.
 *
 * An edge is drawn at opacity = max(perEdgeOpacity, 0) where the trigger
 * sources are:
 *   - `selectedId` matches one endpoint  → 0.9
 *   - `hoveredId` matches one endpoint   → 0.6
 *   - `activeVerbunds` includes the edge → 0.6
 *   - `showAllEdges` is true             → 0.4
 *
 * The endpointPos lookup is a (id → [x, y]) map built by GeoMap. For a
 * cluster, the lookup returns the cluster's coordinates for every member
 * (so edges from any clustered member emanate from the cluster's pin).
 */
import { verbundColor } from '../../lib/peerEdges';
import type { PeerEdge } from '../../lib/peerEdges';

interface Props {
  edges: PeerEdge[];
  endpointPos: Map<string, [number, number]>; // org.identifier -> [x, y]
  selectedId: string | null; // pin id OR cluster key
  hoveredId: string | null;
  activeVerbunds: Set<string>;
  showAllEdges: boolean;
  /** Optional: return the cluster key that an org belongs to, if any. Used
   *  to match selectedId against cluster pins for both endpoints. */
  clusterKeyForOrg: (orgId: string) => string | null;
}

function bezierBetween(x1: number, y1: number, x2: number, y2: number, idx: number): string {
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const dx = x2 - x1,
    dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  const offset = 0.18 * len * (idx % 2 === 0 ? 1 : -1);
  return `M ${x1} ${y1} Q ${mx + nx * offset} ${my + ny * offset} ${x2} ${y2}`;
}

export function GeoMapEdges({
  edges,
  endpointPos,
  selectedId,
  hoveredId,
  activeVerbunds,
  showAllEdges,
  clusterKeyForOrg,
}: Props) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {edges.map((e, i) => {
        const fromPos = endpointPos.get(e.from);
        const toPos = endpointPos.get(e.to);
        if (!fromPos || !toPos) return null;
        // Skip self-edges that arise when both endpoints map to the same cluster pin.
        if (fromPos[0] === toPos[0] && fromPos[1] === toPos[1]) return null;
        const fromKey = clusterKeyForOrg(e.from) ?? e.from;
        const toKey = clusterKeyForOrg(e.to) ?? e.to;
        const isSelectedEdge =
          selectedId !== null && (selectedId === fromKey || selectedId === toKey);
        const isHoveredEdge = hoveredId !== null && (hoveredId === fromKey || hoveredId === toKey);
        const isVerbundEdge = activeVerbunds.has(e.verbund);
        const opacity = isSelectedEdge
          ? 0.9
          : isVerbundEdge
            ? 0.6
            : isHoveredEdge
              ? 0.6
              : showAllEdges
                ? 0.4
                : 0;
        if (opacity === 0) return null;
        return (
          <path
            key={`${e.from}|${e.to}|${e.verbund}|${i}`}
            d={bezierBetween(fromPos[0], fromPos[1], toPos[0], toPos[1], i)}
            stroke={verbundColor(e.verbund)}
            strokeWidth={1.3}
            strokeDasharray="4 3"
            fill="none"
            opacity={opacity}
          />
        );
      })}
    </g>
  );
}
