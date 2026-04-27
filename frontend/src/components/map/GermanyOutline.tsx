/**
 * GermanyOutline.tsx – Recognizable Germany silhouette via a polyline of
 * ~26 anchor points placed at approximate viewBox coordinates of real
 * landmarks. Not a GeoJSON projection but accurate enough that pins from
 * germanCities.ts (Berlin, Münster, München, Hamburg …) sit at plausible
 * positions inside the shape.
 *
 * ViewBox: 0 0 600 760. Anchor coordinates derived by linear projection
 * of (lon ∈ [5.87, 15.04], lat ∈ [47.27, 55.06]) onto (x ∈ [80, 510],
 * y ∈ [30, 720]) for the major boundary points (Husum, Flensburg,
 * Lübeck Bay, Rostock, Greifswald, Polish border, Görlitz, Czech border,
 * Passau, Berchtesgaden, Garmisch, Bodensee, Basel, Saarbrücken, Trier,
 * Aachen, Niederrhein, East Frisia, Cuxhaven, back to Husum).
 */
import React from 'react';

export const GermanyOutline = React.memo(function GermanyOutline() {
  return (
    <path
      d="M 233 80 L 250 50 L 285 75 L 320 130 L 380 115 L 455 105 L 490 145 L 505 230 L 510 380 L 470 415 L 440 500 L 450 590 L 442 700 L 410 715 L 320 715 L 240 705 L 165 705 L 140 620 L 130 540 L 110 490 L 88 410 L 100 320 L 145 245 L 145 175 L 200 145 L 233 80 Z"
      fill="#eef2f7"
      stroke="#cbd5e1"
      strokeWidth="1.5"
    />
  );
});
