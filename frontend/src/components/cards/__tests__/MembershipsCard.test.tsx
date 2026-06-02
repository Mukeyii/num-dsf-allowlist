/**
 * MembershipsCard.test.tsx — renders a membership row (parent org + role) and
 * opens the membership-add modal when the add control is clicked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useModals } from '../../../hooks/useModals';

vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => ({
    data: [{ id: 'm1', parent_organization: 'num.de', roles: ['DIC'], endpoint_id: 'ep1' }],
    isLoading: false,
  }),
  useDeleteMembership: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { identifier: 'ukm.de' }, isLoading: false }),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: [{ identifier: 'fhir.ukm.de' }], isLoading: false }),
}));

import { MembershipsCard } from '../MembershipsCard';

describe('MembershipsCard', () => {
  it('renders a membership row with parent organization and role', () => {
    renderWithProviders(<MembershipsCard instanceId="i1" />);
    expect(screen.getByText('num.de')).toBeInTheDocument();
    expect(screen.getByText(/DIC/)).toBeInTheDocument();
  });

  it('opens the membership-add modal when Add is clicked', async () => {
    renderWithProviders(<MembershipsCard instanceId="i1" />);
    await userEvent.click(screen.getByText('+ Add'));
    expect(useModals.getState().open).toBe('membership-add');
  });
});
