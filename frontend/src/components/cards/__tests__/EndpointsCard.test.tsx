/**
 * EndpointsCard.test.tsx — renders an endpoint row (name, identifier, IP) and
 * opens the endpoint-add modal when the add control is clicked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useModals } from '../../../hooks/useModals';

vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({
    data: [{
      identifier: 'fhir.ukm.de',
      name: 'UKM FHIR',
      address: 'https://fhir.ukm.de/fhir',
      ipAddresses: [{ id: 'ip1', ip: '10.0.0.1', isFhir: true, isBpe: false }],
    }],
    isLoading: false,
  }),
  useDeleteEndpoint: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { identifier: 'ukm.de' }, isLoading: false }),
}));
vi.mock('../../../hooks/useApproval', () => ({
  useApprovalHistory: () => ({ data: [] }),
}));

import { EndpointsCard } from '../EndpointsCard';

describe('EndpointsCard', () => {
  it('renders an endpoint row with name, identifier and IP', () => {
    renderWithProviders(<EndpointsCard instanceId="i1" />);
    expect(screen.getByText('UKM FHIR')).toBeInTheDocument();
    expect(screen.getByText('fhir.ukm.de')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
  });

  it('opens the endpoint-add modal when Add is clicked', async () => {
    renderWithProviders(<EndpointsCard instanceId="i1" />);
    await userEvent.click(screen.getByText('+ Add'));
    expect(useModals.getState().open).toBe('endpoint-add');
  });
});
