/**
 * RelationLines.tsx – SVG overlay with Bezier curves between entity cards.
 * Redraws on mount, resize, scroll, and via ResizeObserver on cards.
 * Uses container-scroll-aware positioning so lines stay aligned after scroll.
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
  { from: 'organization', to: 'contacts',     color: '#9b59b6', opacity: 0.45 },
  { from: 'organization', to: 'endpoints',    color: '#3ecfb2', opacity: 0.45 },
  { from: 'organization', to: 'certificates', color: '#f5a623', opacity: 0.45 },
  { from: 'organization', to: 'memberships',  color: '#4a90d9', opacity: 0.45 },
  { from: 'endpoints',    to: 'memberships',  color: '#4a90d9', opacity: 0.30 },
  { from: 'memberships',  to: 'approval',     color: '#e05c5c', opacity: 0.30 },
] as const;

/**
 * Get the midpoint of a card edge, relative to the container's CONTENT (not viewport).
 * Accounts for container scroll so lines stay correct after scrolling.
 */
function getEdgePoint(
  el: HTMLDivElement,
  container: HTMLDivElement,
  side: 'right' | 'left' | 'bottom' | 'top',
) {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;
  const scrollLeft = container.scrollLeft;

  const relX = (pos: number) => pos - cr.left + scrollLeft;
  const relY = (pos: number) => pos - cr.top + scrollTop;

  switch (side) {
    case 'right':  return { x: relX(er.right),                    y: relY((er.top + er.bottom) / 2) };
    case 'left':   return { x: relX(er.left),                     y: relY((er.top + er.bottom) / 2) };
    case 'bottom': return { x: relX((er.left + er.right) / 2),    y: relY(er.bottom) };
    case 'top':    return { x: relX((er.left + er.right) / 2),    y: relY(er.top) };
  }
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);

  if (dx > dy) {
    const cpOffset = Math.min(dx * 0.4, 60);
    return `M${x1},${y1} C${x1 + cpOffset},${y1} ${x2 - cpOffset},${y2} ${x2},${y2}`;
  } else {
    const cpOffset = Math.min(dy * 0.4, 60);
    return `M${x1},${y1} C${x1},${y1 + cpOffset} ${x2},${y2 - cpOffset} ${x2},${y2}`;
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
      const toEl   = cardRefs[to   as keyof CardRefs].current;
      if (!fromEl || !toEl) return;

      const fromR = fromEl.getBoundingClientRect();
      const toR   = toEl.getBoundingClientRect();

      let p1, p2;
      if (fromR.right + 10 < toR.left) {
        p1 = getEdgePoint(fromEl, container, 'right');
        p2 = getEdgePoint(toEl,   container, 'left');
      } else if (toR.right + 10 < fromR.left) {
        p1 = getEdgePoint(fromEl, container, 'left');
        p2 = getEdgePoint(toEl,   container, 'right');
      } else if (fromR.bottom < toR.top) {
        p1 = getEdgePoint(fromEl, container, 'bottom');
        p2 = getEdgePoint(toEl,   container, 'top');
      } else if (toR.bottom < fromR.top) {
        p1 = getEdgePoint(fromEl, container, 'top');
        p2 = getEdgePoint(toEl,   container, 'bottom');
      } else {
        p1 = getEdgePoint(fromEl, container, 'right');
        p2 = getEdgePoint(toEl,   container, 'left');
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', bezierPath(p1.x, p1.y, p2.x, p2.y));
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-dasharray', '5 4');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', String(opacity));
      svg.appendChild(path);

      [p1, p2].forEach(p => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(p.x));
        dot.setAttribute('cy', String(p.y));
        dot.setAttribute('r', '3');
        dot.setAttribute('fill', color);
        dot.setAttribute('opacity', String(Math.min(1, opacity + 0.2)));
        svg.appendChild(dot);
      });
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
