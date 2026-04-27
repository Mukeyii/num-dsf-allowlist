/**
 * GermanyOutline.tsx – Real Germany silhouette via the Wikimedia Commons
 * SVG (Karte_Deutschland.svg) served from /germany.svg.
 *
 * Source: https://upload.wikimedia.org/wikipedia/commons/e/e3/Karte_Deutschland.svg
 * Native viewBox: 0 0 591.504 800.504. The parent SVG (GeoMap.tsx) uses
 * the same viewBox so the image renders 1:1 and city coordinates from
 * germanCities.ts (which are derived by lat/lon → native-pixel projection
 * x = 110 + (lon - 5.87) · 48, y = 15 + (55.06 - lat) · 74.5) sit at
 * plausible positions inside the country.
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
