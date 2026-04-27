/**
 * GermanyOutline.tsx – Inlined Germany silhouette (16 federal-state paths).
 * Theme-aware: light mode uses transparent magenta tones; dark mode inverts
 * to a slate palette so the silhouette reads against a dark backdrop.
 */
import React from 'react';
import { GERMANY_PATHS } from './germanyPaths';
import { useThemeStore } from '../../stores/theme.store';

export const GermanyOutline = React.memo(function GermanyOutline() {
  const dark = useThemeStore(s => s.dark);
  const fill = dark ? '#1e293b' : '#fde3ef';
  const stroke = dark ? '#94a3b8' : '#b01e66';
  const fillOpacity = dark ? 0.7 : 0.55;
  const strokeOpacity = dark ? 0.45 : 0.25;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {GERMANY_PATHS.map(p => (
        <path
          key={p.id}
          d={p.d}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={0.5}
          strokeOpacity={strokeOpacity}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
});
