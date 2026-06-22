/**
 * EntityCanvas.lines.test.tsx — the TARGET described "SVG relation lines / bezier
 * <path> per FK relation", but the actual EntityCanvas renders no SVG at all: it is
 * a responsive grid that renders the five entity cards directly (plus the
 * OnboardingWizard) and switches between 1/2/3 columns based on
 * window.innerWidth. These tests assert that real rendered structure and the
 * column-breakpoint behavior. Each child card and the wizard are stubbed so the
 * assertions stay deterministic and isolated to EntityCanvas's own layout logic.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

// Stub every child so the test exercises only EntityCanvas's layout, not the
// cards' own data hooks. Each stub echoes its instanceId so we can prove the
// prop is threaded through.
vi.mock('../OnboardingWizard', () => ({
  OnboardingWizard: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="onboarding-wizard">wizard:{instanceId}</div>
  ),
}));
vi.mock('../../cards/OrganizationCard', () => ({
  OrganizationCard: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="organization-card">org:{instanceId}</div>
  ),
}));
vi.mock('../../cards/ContactsCard', () => ({
  ContactsCard: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="contacts-card">contacts:{instanceId}</div>
  ),
}));
vi.mock('../../cards/EndpointsCard', () => ({
  EndpointsCard: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="endpoints-card">endpoints:{instanceId}</div>
  ),
}));
vi.mock('../../cards/CertificatesCard', () => ({
  CertificatesCard: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="certificates-card">certificates:{instanceId}</div>
  ),
}));
vi.mock('../../cards/MembershipsCard', () => ({
  MembershipsCard: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="memberships-card">memberships:{instanceId}</div>
  ),
}));

import { EntityCanvas } from '../EntityCanvas';

const CARD_TESTIDS = [
  'organization-card',
  'contacts-card',
  'endpoints-card',
  'memberships-card',
  'certificates-card',
] as const;

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  setInnerWidth(originalInnerWidth);
  vi.clearAllMocks();
});

describe('EntityCanvas layout (no SVG relation lines exist)', () => {
  it('renders no SVG / bezier <path> relation lines — the canvas is a plain grid', () => {
    setInnerWidth(1600);
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });

  it('renders all five entity cards plus the onboarding wizard (3-col layout)', () => {
    setInnerWidth(1600); // 1600 - 500 = 1100 effective → 3 columns
    renderWithProviders(<EntityCanvas instanceId="i1" />);

    for (const testId of CARD_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });

  it('threads instanceId down to the wizard and every card', () => {
    setInnerWidth(1600);
    renderWithProviders(<EntityCanvas instanceId="abc-123" />);
    expect(screen.getByTestId('onboarding-wizard')).toHaveTextContent('wizard:abc-123');
    expect(screen.getByTestId('organization-card')).toHaveTextContent('org:abc-123');
    expect(screen.getByTestId('contacts-card')).toHaveTextContent('contacts:abc-123');
    expect(screen.getByTestId('endpoints-card')).toHaveTextContent('endpoints:abc-123');
    expect(screen.getByTestId('certificates-card')).toHaveTextContent('certificates:abc-123');
    expect(screen.getByTestId('memberships-card')).toHaveTextContent('memberships:abc-123');
  });

  it('uses a 3-column grid when effective width is wide (>= 800)', () => {
    setInnerWidth(1600); // 1100 effective → 3 cols
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);
    const grid = container.querySelector<HTMLElement>('div[style*="grid-template-columns"]');
    expect(grid).not.toBeNull();
    expect(grid?.style.gridTemplateColumns).toBe('1fr 1fr 1fr');
  });

  it('uses a 2-column grid at the mid breakpoint (500 <= effective < 800)', () => {
    setInnerWidth(1100); // 1100 - 500 = 600 effective → 2 cols
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);
    const grid = container.querySelector<HTMLElement>('div[style*="grid-template-columns"]');
    expect(grid).not.toBeNull();
    expect(grid?.style.gridTemplateColumns).toBe('1fr 1fr');
  });

  it('uses a single stacked column at the narrow breakpoint (effective < 500)', () => {
    setInnerWidth(900); // 900 - 500 = 400 effective → 1 col
    const { container } = renderWithProviders(<EntityCanvas instanceId="i1" />);
    // No grid container in the 1-column branch — cards stack in a flex column.
    expect(container.querySelector('div[style*="grid-template-columns"]')).toBeNull();
    // All five cards are still present in the single-column layout.
    for (const testId of CARD_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });
});
