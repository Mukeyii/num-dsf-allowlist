/**
 * Skeleton.test.tsx — the loading-placeholder primitives render the right number
 * of pulsing bars. Skeleton emits one bar per `lines` (default 3), applies an
 * extra `className` to every bar, and varies bar widths by index. CardSkeleton
 * wraps a four-line Skeleton inside an animated card shell. These are pure
 * presentational components with no hooks/stores, so we assert the real DOM.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, CardSkeleton } from '../Skeleton';

/** The pulsing bars are the leaf divs carrying the bar height/background classes. */
function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('div.h-3.bg-slate-100.rounded-full'));
}

describe('Skeleton', () => {
  it('renders three placeholder bars by default inside an animated container', () => {
    const { container } = render(<Skeleton />);

    const wrapper = container.querySelector('div.animate-pulse');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('space-y-3');
    expect(bars(container)).toHaveLength(3);
  });

  it('renders exactly `lines` placeholder bars', () => {
    const { container } = render(<Skeleton lines={5} />);
    expect(bars(container)).toHaveLength(5);
  });

  it('renders no bars when lines is zero', () => {
    const { container } = render(<Skeleton lines={0} />);
    expect(bars(container)).toHaveLength(0);
  });

  it('applies the extra className to every bar', () => {
    const { container } = render(<Skeleton lines={3} className="opacity-50" />);
    const rendered = bars(container);
    expect(rendered).toHaveLength(3);
    for (const bar of rendered) {
      expect(bar).toHaveClass('opacity-50');
    }
  });

  it('varies bar widths by index (first 3/4, even half, odd full)', () => {
    const { container } = render(<Skeleton lines={4} />);
    const rendered = bars(container);
    expect(rendered).toHaveLength(4);
    expect(rendered[0]).toHaveClass('w-3/4'); // i === 0
    expect(rendered[1]).toHaveClass('w-full'); // odd
    expect(rendered[2]).toHaveClass('w-1/2'); // even, non-zero
    expect(rendered[3]).toHaveClass('w-full'); // odd
  });
});

describe('CardSkeleton', () => {
  it('renders an animated card shell wrapping a four-line skeleton', () => {
    const { container } = render(<CardSkeleton />);

    const shell = container.querySelector('div.entity-card-shadow');
    expect(shell).not.toBeNull();
    expect(shell).toHaveClass('animate-pulse');

    // The nested Skeleton is rendered with lines={4}.
    expect(bars(container)).toHaveLength(4);
  });
});
