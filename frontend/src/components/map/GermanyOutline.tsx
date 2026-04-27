/**
 * GermanyOutline.tsx – Inlined Germany silhouette via 17 federal-state paths
 * extracted from the Wikimedia Karte_Deutschland.svg (see germanyPaths.ts).
 *
 * Rendered with the app's transparent magenta-pink color scheme so the
 * country acts as a soft watermark behind the pins, not as a heavy
 * graphic that competes with them. State borders are drawn at very low
 * opacity for subtle context only.
 */
import React from 'react';
import { GERMANY_PATHS } from './germanyPaths';

export const GermanyOutline = React.memo(function GermanyOutline() {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {GERMANY_PATHS.map(p => (
        <path
          key={p.id}
          d={p.d}
          fill="#fde3ef"
          fillOpacity={0.55}
          stroke="#b01e66"
          strokeWidth={0.5}
          strokeOpacity={0.25}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
});
