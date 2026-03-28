/**
 * RelationLines.tsx – SVG orthogonal connectors between entity cards
 * Uses right-angle paths (not curves) for clear, readable connections.
 * Redraws on mount, resize, scroll, and card size changes.
 */
import { useEffect, useRef, useCallback } from 'react';

interface CardRefs {
  organization: React.RefObject<HTMLDivElement>;
  contacts:     React.RefObject<HTMLDivElement>;
  endpoints:    React.RefObject<HTMLDivElement>;
  certificates: React.RefObject<HTMLDivElement>;
  memberships:  React.RefObject<HTMLDivElement>;
  approval:     React.RefObject<HTMLDivElement>;
}

interface RelationLinesProps {
  cardRefs: CardRefs;
  containerRef: React.RefObject<HTMLDivElement>;
}

const RELATIONS = [
  { from: 'organization', to: 'contacts',     color: '#9b59b6', opacity: 0.4 },
  { from: 'organization', to: 'endpoints',    color: '#3ecfb2', opacity: 0.4 },
  { from: 'organization', to: 'certificates', color: '#f5a623', opacity: 0.4 },
  { from: 'organization', to: 'memberships',  color: '#4a90d9', opacity: 0.4 },
  { from: 'endpoints',    to: 'memberships',  color: '#4a90d9', opacity: 0.25 },
  { from: 'memberships',  to: 'approval',     color: '#e05c5c', opacity: 0.25 },
] as const;

function getRect(el: HTMLDivElement, container: HTMLDivElement) {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  const st = container.scrollTop;
  const sl = container.scrollLeft;
  return {
    left: er.left - cr.left + sl,
    right: er.right - cr.left + sl,
    top: er.top - cr.top + st,
    bottom: er.bottom - cr.top + st,
    cx: (er.left + er.right) / 2 - cr.left + sl,
    cy: (er.top + er.bottom) / 2 - cr.top + st,
  };
}

/**
 * Build an orthogonal (right-angle) path between two rectangles.
 * Picks the best edge pair and routes with a single midpoint bend.
 */
function orthogonalPath(fromRect: ReturnType<typeof getRect>, toRect: ReturnType<typeof getRect>): string {
  const gap = 10;

  // Determine relative position
  const isRight = fromRect.right + gap < toRect.left;
  const isLeft = toRect.right + gap < fromRect.left;
  const isBelow = fromRect.bottom + gap < toRect.top;
  const isAbove = toRect.bottom + gap < fromRect.top;

  let x1: number, y1: number, x2: number, y2: number;

  if (isRight) {
    // From right edge → To left edge, horizontal-first
    x1 = fromRect.right;
    y1 = fromRect.cy;
    x2 = toRect.left;
    y2 = toRect.cy;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} H${mx} V${y2} H${x2}`;
  } else if (isLeft) {
    x1 = fromRect.left;
    y1 = fromRect.cy;
    x2 = toRect.right;
    y2 = toRect.cy;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} H${mx} V${y2} H${x2}`;
  } else if (isBelow) {
    // From bottom edge → To top edge, vertical-first
    x1 = fromRect.cx;
    y1 = fromRect.bottom;
    x2 = toRect.cx;
    y2 = toRect.top;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} V${my} H${x2} V${y2}`;
  } else if (isAbove) {
    x1 = fromRect.cx;
    y1 = fromRect.top;
    x2 = toRect.cx;
    y2 = toRect.bottom;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} V${my} H${x2} V${y2}`;
  } else {
    // Overlapping — fallback to right→left
    x1 = fromRect.right;
    y1 = fromRect.cy;
    x2 = toRect.left;
    y2 = toRect.cy;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} H${mx} V${y2} H${x2}`;
  }
}

export function RelationLines({ cardRefs, containerRef }: RelationLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    svg.innerHTML = '';
    svg.setAttribute('width', String(container.scrollWidth));
    svg.setAttribute('height', String(container.scrollHeight));

    RELATIONS.forEach(({ from, to, color, opacity }) => {
      const fromEl = cardRefs[from as keyof CardRefs].current;
      const toEl = cardRefs[to as keyof CardRefs].current;
      if (!fromEl || !toEl) return;

      const fromRect = getRect(fromEl, container);
      const toRect = getRect(toEl, container);

      const d = orthogonalPath(fromRect, toRect);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', String(opacity));
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);

      // Start and end dots
      const startMatch = d.match(/^M([\d.]+),([\d.]+)/);
      if (startMatch) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', startMatch[1]);
        dot.setAttribute('cy', startMatch[2]);
        dot.setAttribute('r', '3');
        dot.setAttribute('fill', color);
        dot.setAttribute('opacity', String(Math.min(1, opacity + 0.2)));
        svg.appendChild(dot);
      }

      // End dot — parse the last coordinates from the path
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', d);
      svg.appendChild(pathEl);
      const totalLen = pathEl.getTotalLength();
      if (totalLen > 0) {
        const endPt = pathEl.getPointAtLength(totalLen);
        const endDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        endDot.setAttribute('cx', String(endPt.x));
        endDot.setAttribute('cy', String(endPt.y));
        endDot.setAttribute('r', '3');
        endDot.setAttribute('fill', color);
        endDot.setAttribute('opacity', String(Math.min(1, opacity + 0.2)));
        svg.appendChild(endDot);
      }
      svg.removeChild(pathEl);
    });
  }, [cardRefs, containerRef]);

  useEffect(() => {
    const container = containerRef.current;

    const t1 = setTimeout(draw, 200);
    const t2 = setTimeout(draw, 800);
    const t3 = setTimeout(draw, 2000);

    window.addEventListener('resize', draw);
    container?.addEventListener('scroll', draw);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      observer = new ResizeObserver(draw);
      Object.values(cardRefs).forEach(ref => {
        if (ref.current) observer!.observe(ref.current);
      });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', draw);
      container?.removeEventListener('scroll', draw);
      observer?.disconnect();
    };
  }, [draw, cardRefs, containerRef]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        pointerEvents: 'none', zIndex: 1,
        overflow: 'visible',
      }}
    />
  );
}
