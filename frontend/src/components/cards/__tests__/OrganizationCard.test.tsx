/**
 * OrganizationCard.test.tsx — renders the org summary (identifier, name, email)
 * and opens the org-edit modal when the edit control is clicked.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useModals } from '../../../hooks/useModals';

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({
    data: {
      identifier: 'ukm.de',
      name: 'University Hospital Muenster',
      email: 'org@ukm.de',
      active: true,
      address_line: 'Albert-Schweitzer-Campus 1',
      postal_code: '48149',
      city: 'Muenster',
      country_code: 'DE',
      client_cert_thumbprint: '',
    },
    isLoading: false,
  }),
  useUpdateOrganization: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../../hooks/useApproval', () => ({
  useApprovalStatus: () => ({ data: { status: 'PENDING' } }),
}));

import { OrganizationCard } from '../OrganizationCard';

describe('OrganizationCard', () => {
  it('renders the organization identifier and name', () => {
    renderWithProviders(<OrganizationCard instanceId="i1" />);
    expect(screen.getByText('ukm.de')).toBeInTheDocument();
    expect(screen.getByText('University Hospital Muenster')).toBeInTheDocument();
  });

  it('opens the org-edit modal when Edit is clicked', async () => {
    renderWithProviders(<OrganizationCard instanceId="i1" />);
    await userEvent.click(screen.getByText('Edit'));
    expect(useModals.getState().open).toBe('org-edit');
  });
});
