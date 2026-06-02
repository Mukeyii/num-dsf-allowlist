import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => ({ data: [], isLoading: false }),
  useCreateMembership: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useUpdateMembership: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: [], isLoading: false }),
}));

import { MembershipModal } from '../MembershipModal';

describe('MembershipModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <MembershipModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and parent-organization field when open', () => {
    renderWithProviders(<MembershipModal open onClose={() => {}} instanceId="i1" />);
    expect(screen.getByRole('heading', { name: /add new membership/i })).toBeInTheDocument();
    expect(screen.getAllByText(/parent organization/i).length).toBeGreaterThan(0);
  });

  it('shows a validation error when submitting empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MembershipModal open onClose={() => {}} instanceId="i1" />);
    await user.click(screen.getByRole('button', { name: /add membership/i }));
    expect(await screen.findByText(/parent organization is required/i)).toBeInTheDocument();
  });
});
