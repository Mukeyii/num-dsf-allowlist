/**
 * GermanyOutline.tsx – Schematic Germany silhouette as a single SVG path.
 * Hand-drawn approximation; not a GeoJSON projection. ViewBox: 0 0 600 760.
 *
 * Design intent: convey "this is Germany" at a glance without the visual
 * weight of a precise geographic outline. Country shape is recognizable
 * enough that pinned cities sit in plausible positions (Berlin top-right,
 * Munich south, Hamburg north, etc.).
 */
import React from 'react';

export const GermanyOutline = React.memo(function GermanyOutline() {
  return (
    <path
      d="M 200 60 Q 280 50 360 70 Q 440 75 490 100 Q 510 150 510 230 Q 510 320 500 400 Q 480 460 460 510 Q 470 580 450 640 Q 410 700 350 720 Q 280 715 230 695 Q 195 640 200 570 Q 170 500 150 430 Q 130 380 120 320 Q 105 270 130 220 Q 145 160 165 120 Q 175 80 200 60 Z"
      fill="#eef2f7"
      stroke="#cbd5e1"
      strokeWidth="1.5"
    />
  );
});
