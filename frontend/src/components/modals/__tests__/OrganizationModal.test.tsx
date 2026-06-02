import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useOrganization', () => ({
  useUpdateOrganization: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

import { OrganizationModal } from '../OrganizationModal';

describe('OrganizationModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <OrganizationModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and the name field when open', () => {
    renderWithProviders(<OrganizationModal open onClose={() => {}} instanceId="i1" />);
    expect(screen.getByRole('heading', { name: /edit organization/i })).toBeInTheDocument();
    expect(screen.getByText(/^Name$/)).toBeInTheDocument();
  });

  it('shows a validation error when submitting empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationModal open onClose={() => {}} instanceId="i1" />);
    await user.click(screen.getByRole('button', { name: /save organization/i }));
    // identifier/name/email are required by organizationSchema — inline errors surface.
    expect((await screen.findAllByText(/required|valid|invalid/i)).length).toBeGreaterThan(0);
  });
});
