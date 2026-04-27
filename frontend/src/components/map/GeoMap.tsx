/**
 * GeoMap.tsx – Top-level SVG of the network map. Renders the Germany
 * silhouette + pins at city coordinates. Tooltip layer is rendered last
 * so it sits above all pins. Clusters and edges are added in later tasks.
 *
 * Dependencies: GermanyOutline, GeoMapPin, germanCities, useI18n,
 *               network.api types.
 */
import { useMemo, useState } from 'react';
import type { MapOrganization } from '../../api/network.api';
import { GermanyOutline } from './GermanyOutline';
import { GeoMapPin } from './GeoMapPin';
import { getPinCoord } from '../../lib/germanCities';
import { useI18n } from '../../stores/i18n.store';

interface Props {
  organizations: MapOrganization[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface Placed {
  org: MapOrganization;
  x: number;
  y: number;
  known: boolean;
}

export function GeoMap({ organizations, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Only orgs with country_code === 'DE' or null land on the map.
  // International orgs are listed elsewhere (Task 6).
  const onMap = useMemo(
    () => organizations.filter(o => (o.country_code ?? 'DE') === 'DE'),
    [organizations],
  );

  const placed = useMemo<Placed[]>(
    () => onMap.map(org => {
      const { coord, known } = getPinCoord(org.city);
      return { org, x: coord[0], y: coord[1], known };
    }),
    [onMap],
  );

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
    return placed.find(p => p.org.identifier === id) ?? null;
  })();

  return (
    <svg
      viewBox="0 0 600 760"
      style={{ width: '100%', height: '100%', display: 'block' }}
      onClick={() => onSelect(null)}
    >
      <rect width="600" height="760" fill="#f8fafc" />
      <GermanyOutline />

      {/* Sonstige stripe label (small, faint) */}
      <rect x="540" y="120" width="40" height="580" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 3" />
      <text x="560" y="115" textAnchor="middle" fontSize="9" fill="#94a3b8">{t('mapSonstigeLabel')}</text>

      {placed.map(({ org, x, y, known }) => (
        <GeoMapPin
          key={org.identifier}
          org={org} x={x} y={y}
          isHovered={hoveredId === org.identifier}
          isSelected={selectedId === org.identifier}
          isUnknown={!known}
          onSelect={onSelect}
          onHover={setHoveredId}
        />
      ))}

      {/* Tooltip — rendered AFTER all pins so it never hides behind one */}
      {tooltipTarget && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={tooltipTarget.x - 90}
            y={tooltipTarget.y - 50}
            width={180} height={36} rx={8}
            fill="#0f172a" opacity={0.92}
          />
          <text x={tooltipTarget.x} y={tooltipTarget.y - 35}
                textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
            {tooltipTarget.org.name}
          </text>
          <text x={tooltipTarget.x} y={tooltipTarget.y - 22}
                textAnchor="middle" fontSize={9} fill="#cbd5e1">
            {tooltipTarget.org.city ?? '—'} {tooltipTarget.org.country_code ? `· ${tooltipTarget.org.country_code}` : ''}
          </text>
        </g>
      )}
    </svg>
  );
}
