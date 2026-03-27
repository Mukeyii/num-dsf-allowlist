/**
 * RelationLines.tsx – SVG overlay with Bezier curves between card refs.
 * Redraws on mount + window resize. pointer-events: none.
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

function getMid(el: HTMLDivElement, container: HTMLDivElement, side: 'right' | 'left' | 'bottom' | 'top') {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  switch (side) {
    case 'right':  return { x: er.right  - cr.left, y: (er.top + er.bottom) / 2 - cr.top };
    case 'left':   return { x: er.left   - cr.left, y: (er.top + er.bottom) / 2 - cr.top };
    case 'bottom': return { x: (er.left + er.right) / 2 - cr.left, y: er.bottom - cr.top };
    case 'top':    return { x: (er.left + er.right) / 2 - cr.left, y: er.top    - cr.top };
  }
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export function RelationLines({ cardRefs, containerRef }: RelationLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    svg.innerHTML = '';
    const cr = container.getBoundingClientRect();
    svg.setAttribute('width',  String(cr.width));
    svg.setAttribute('height', String(cr.height));

    RELATIONS.forEach(({ from, to, color, opacity }) => {
      const fromEl = cardRefs[from as keyof CardRefs].current;
      const toEl   = cardRefs[to   as keyof CardRefs].current;
      if (!fromEl || !toEl) return;

      const fromR = fromEl.getBoundingClientRect();
      const toR   = toEl.getBoundingClientRect();

      let p1, p2;
      if (fromR.right < toR.left) {
        p1 = getMid(fromEl, container, 'right');
        p2 = getMid(toEl,   container, 'left');
      } else if (fromR.bottom < toR.top) {
        p1 = getMid(fromEl, container, 'bottom');
        p2 = getMid(toEl,   container, 'top');
      } else {
        p1 = getMid(fromEl, container, 'right');
        p2 = getMid(toEl,   container, 'left');
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
        dot.setAttribute('opacity', String(opacity + 0.2));
        svg.appendChild(dot);
      });
    });
  }, [cardRefs, containerRef]);

  useEffect(() => {
    const timer = setTimeout(draw, 150);
    window.addEventListener('resize', draw);
    return () => { clearTimeout(timer); window.removeEventListener('resize', draw); };
  }, [draw]);

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
