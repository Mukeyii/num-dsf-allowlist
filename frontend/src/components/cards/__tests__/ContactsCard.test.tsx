/**
 * ContactsCard.test.tsx — renders a contact row (name + type badge) and opens
 * the contact-add modal when the add control is clicked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useModals } from '../../../hooks/useModals';

vi.mock('../../../hooks/useContacts', () => ({
  useContacts: () => ({
    data: [{ id: 'c1', name: 'Dr. Test', email: 'd@ukm.de', types: ['MEDIC'], email_validated: true }],
    isLoading: false,
  }),
  useDeleteContact: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { identifier: 'ukm.de' }, isLoading: false }),
}));

import { ContactsCard } from '../ContactsCard';

describe('ContactsCard', () => {
  it('renders a contact row with its type badge', () => {
    renderWithProviders(<ContactsCard instanceId="i1" />);
    expect(screen.getByText(/Dr\. Test/)).toBeInTheDocument();
    expect(screen.getByText('MEDIC')).toBeInTheDocument();
  });

  it('opens the contact-add modal when Add is clicked', async () => {
    renderWithProviders(<ContactsCard instanceId="i1" />);
    await userEvent.click(screen.getByText('+ Add'));
    expect(useModals.getState().open).toBe('contact-add');
  });
});
