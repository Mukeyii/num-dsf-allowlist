/**
 * ReadinessChecklist.test.tsx — covers the right-panel readiness checklist. The
 * five entity hooks are mocked (vi.hoisted + vi.mock) so each test feeds exact
 * .data into deriveReadiness without touching the network. Test 1: every step
 * satisfied -> the ready summary renders. Test 2: empty endpoints -> the open
 * summary with one step left renders and the endpoints row is an actionable
 * button that, when clicked, calls highlightEntity('endpoints') (asserted via a
 * spy and via the store's highlightedEntity state).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useCanvasStore } from '../../../stores/canvas.store';

const useOrganization = vi.hoisted(() => vi.fn());
const useContacts = vi.hoisted(() => vi.fn());
const useEndpoints = vi.hoisted(() => vi.fn());
const useCertificates = vi.hoisted(() => vi.fn());
const useMemberships = vi.hoisted(() => vi.fn());

vi.mock('../../../hooks/useOrganization', () => ({ useOrganization }));
vi.mock('../../../hooks/useContacts', () => ({ useContacts }));
vi.mock('../../../hooks/useEndpoints', () => ({ useEndpoints }));
vi.mock('../../../hooks/useCertificates', () => ({ useCertificates }));
vi.mock('../../../hooks/useMemberships', () => ({ useMemberships }));

import { ReadinessChecklist } from '../ReadinessChecklist';

// A valid_until far in the future so the certificate step always reads as done.
const FAR_FUTURE = '2099-01-01';

beforeEach(() => {
  vi.clearAllMocks();
  useCanvasStore.setState({ highlightedEntity: null });
  useOrganization.mockReturnValue({ data: { active: true } });
  useContacts.mockReturnValue({ data: [{ id: 'ct1' }] });
  useEndpoints.mockReturnValue({ data: [{ identifier: 'fhir.ukm.de' }] });
  useCertificates.mockReturnValue({ data: [{ id: 'c1', valid_until: FAR_FUTURE }] });
  useMemberships.mockReturnValue({ data: [{ id: 'm1' }] });
});

describe('ReadinessChecklist', () => {
  it('shows the ready summary when every step is satisfied', () => {
    renderWithProviders(<ReadinessChecklist instanceId="i1" />);
    expect(screen.getByText('Ready to submit')).toBeInTheDocument();
  });

  it('shows the open summary with one step left when endpoints are empty', () => {
    useEndpoints.mockReturnValue({ data: [] });
    renderWithProviders(<ReadinessChecklist instanceId="i1" />);
    expect(screen.getByText('1 step(s) left')).toBeInTheDocument();
  });

  it('jumps to the endpoints card when its open row is clicked', () => {
    useEndpoints.mockReturnValue({ data: [] });
    const highlightSpy = vi.spyOn(useCanvasStore.getState(), 'highlightEntity');
    renderWithProviders(<ReadinessChecklist instanceId="i1" />);

    const button = screen.getByRole('button', { name: /Endpoint/ });
    fireEvent.click(button);

    expect(highlightSpy).toHaveBeenCalledWith('endpoints');
    expect(useCanvasStore.getState().highlightedEntity).toBe('endpoints');
  });
});
