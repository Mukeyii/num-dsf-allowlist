/**
 * EntityCanvas.highlight.test.tsx — covers the two interaction-driven redraws
 * the canvas is responsible for, distinct from the relation-lines geometry test:
 *
 *  1. FK-highlight emphasis — when the canvas store's `highlightedEntity` matches
 *     a card's id, that card renders the emphasis `outline` while sibling cards
 *     stay un-emphasised; clearing the highlight removes the outline again.
 *  2. Resize redraw — changing `window.innerWidth` and dispatching a `resize`
 *     event re-evaluates the column layout, switching the grid template from
 *     three columns to a single stacked column (and back).
 *
 * The five entity data hooks (also read by the OnboardingWizard the canvas
 * mounts) are mocked so the real card DOM renders deterministically. A
 * ResizeObserver stub and a getBoundingClientRect mock keep layout-reading code
 * inert under jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useCanvasStore } from '../../../stores/canvas.store';

// --- Data-hook mocks (filled with empty/loaded defaults below) -------------
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: vi.fn(),
  useUpdateOrganization: vi.fn(),
}));
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: vi.fn(),
  useDeleteContact: vi.fn(),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: vi.fn(),
  useDeleteEndpoint: vi.fn(),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: vi.fn(),
  useDeleteCertificate: vi.fn(),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: vi.fn(),
  useDeleteMembership: vi.fn(),
}));
vi.mock('../../../hooks/useApproval', () => ({
  useApprovalStatus: vi.fn(),
  useApprovalHistory: vi.fn(),
}));

import { useOrganization, useUpdateOrganization } from '../../../hooks/useOrganization';
import { useContacts, useDeleteContact } from '../../../hooks/useContacts';
import { useEndpoints, useDeleteEndpoint } from '../../../hooks/useEndpoints';
import { useCertificates, useDeleteCertificate } from '../../../hooks/useCertificates';
import { useMemberships, useDeleteMembership } from '../../../hooks/useMemberships';
import { useApprovalStatus, useApprovalHistory } from '../../../hooks/useApproval';

import { EntityCanvas } from '../EntityCanvas';

// Minimal query-result shapes — cards/wizard only read .data / .isLoading.
const ok = (data: unknown) => ({ data, isLoading: false }) as never;
const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined) }) as never;

// Read the rendered outline of an EntityCard. The canvas wraps each card in an
// outer `<div id="card-<id>">`, and EntityCard itself also renders `id="card-<id>"`
// — so we target the EntityCard element specifically by its shadow class, which
// is the element carrying the FK-highlight outline.
function outlineOf(container: HTMLElement, id: string): string {
  const cards = container.querySelectorAll<HTMLElement>(`#card-${id}.entity-card-shadow`);
  if (cards.length !== 1) throw new Error(`expected one EntityCard for ${id}, got ${cards.length}`);
  // jsdom serialises an unset outline as '' and `outline: none` as 'none'; treat
  // both as "no emphasis" so the assertion is about the coloured outline only.
  return cards[0].style.outline || 'none';
}

// Set viewport width and fire the resize the canvas listens for.
function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

let originalInnerWidth: number;
let originalResizeObserver: typeof globalThis.ResizeObserver | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  useCanvasStore.setState({ highlightedEntity: null });
  originalInnerWidth = window.innerWidth;

  // Inert ResizeObserver + getBoundingClientRect so any layout-reading path is
  // deterministic under jsdom (which provides neither in a useful form).
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof globalThis.ResizeObserver;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    toJSON: () => ({}),
  } as DOMRect);

  // Loaded org so cards render their real header DOM; everything else empty.
  vi.mocked(useOrganization).mockReturnValue(ok({ identifier: 'ukm.de', name: 'UKM' }));
  vi.mocked(useUpdateOrganization).mockReturnValue(mut());
  vi.mocked(useContacts).mockReturnValue(ok([]));
  vi.mocked(useDeleteContact).mockReturnValue(mut());
  vi.mocked(useEndpoints).mockReturnValue(ok([]));
  vi.mocked(useDeleteEndpoint).mockReturnValue(mut());
  vi.mocked(useCertificates).mockReturnValue(ok([]));
  vi.mocked(useDeleteCertificate).mockReturnValue(mut());
  vi.mocked(useMemberships).mockReturnValue(ok([]));
  vi.mocked(useDeleteMembership).mockReturnValue(mut());
  vi.mocked(useApprovalStatus).mockReturnValue(ok({ status: 'PENDING' }));
  vi.mocked(useApprovalHistory).mockReturnValue(ok([]));
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
  if (originalResizeObserver) globalThis.ResizeObserver = originalResizeObserver;
  useCanvasStore.setState({ highlightedEntity: null });
});

describe('EntityCanvas FK-highlight emphasis', () => {
  it('outlines only the card whose id matches highlightedEntity', () => {
    setViewport(1600); // wide → three columns, all cards mounted
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);

    // Nothing highlighted yet → no card carries an outline.
    expect(outlineOf(container, 'organization')).toBe('none');
    expect(outlineOf(container, 'contacts')).toBe('none');

    // Highlight the organization entity (as a FK-link click would).
    act(() => {
      useCanvasStore.getState().highlightEntity('organization');
    });

    // The matching card gains a coloured outline; siblings stay 'none'.
    const orgOutline = outlineOf(container, 'organization');
    expect(orgOutline).not.toBe('none');
    expect(orgOutline).toContain('solid');
    expect(outlineOf(container, 'contacts')).toBe('none');
    expect(outlineOf(container, 'endpoints')).toBe('none');
  });

  it('clears the emphasis when the highlight is removed', () => {
    setViewport(1600);
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);

    act(() => {
      useCanvasStore.getState().highlightEntity('contacts');
    });
    expect(outlineOf(container, 'contacts')).not.toBe('none');

    act(() => {
      useCanvasStore.setState({ highlightedEntity: null });
    });
    expect(outlineOf(container, 'contacts')).toBe('none');
  });
});

describe('EntityCanvas resize redraw', () => {
  it('switches from a three-column grid to a single stacked column on narrow resize', () => {
    setViewport(1600); // effective width 1100 → 3 cols
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);

    const grid = () => container.querySelector<HTMLElement>('div[style*="grid-template-columns"]');
    expect(grid()?.style.gridTemplateColumns).toBe('1fr 1fr 1fr');

    // Shrink below the single-column breakpoint (innerWidth-500 < 500).
    setViewport(900); // effective width 400 → 1 col, stacked flex, no grid
    expect(grid()).toBeNull();
    // The organization card is still rendered in the single-column layout.
    expect(container.querySelector('#card-organization')).not.toBeNull();

    // Widen again → the three-column grid comes back.
    setViewport(1600);
    expect(grid()?.style.gridTemplateColumns).toBe('1fr 1fr 1fr');
  });

  it('uses the two-column grid at an intermediate width', () => {
    setViewport(1100); // effective width 600 → 2 cols
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);

    const grid = container.querySelector<HTMLElement>('div[style*="grid-template-columns"]');
    expect(grid?.style.gridTemplateColumns).toBe('1fr 1fr');
  });
});
