/**
 * GermanyOutline.tsx – Real Germany silhouette via the Wikimedia Commons
 * SVG (Karte_Deutschland.svg) served from /germany.svg.
 *
 * Source: https://upload.wikimedia.org/wikipedia/commons/e/e3/Karte_Deutschland.svg
 * Native viewBox: 0 0 591.504 800.504. The parent SVG (GeoMap.tsx) uses
 * a wider viewBox (700×800) so there's room on the right for the
 * Sonstige stripe; the image is positioned at (0,0) at native size, so
 * city coordinates from germanCities.ts (derived from real Wikimedia
 * state-path centroids: x = lon · 62.4 − 355, y = 5720 − lat · 104)
 * sit at plausible positions inside the country.
 */
import React from 'react';

export const GermanyOutline = React.memo(function GermanyOutline() {
  return (
    <image
      href="/germany.svg"
      x={0}
      y={0}
      width={591.504}
      height={800.504}
      preserveAspectRatio="none"
    />
  );
});
