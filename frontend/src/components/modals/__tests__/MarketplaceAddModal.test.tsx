/**
 * MarketplaceAddModal.test.tsx — covers the add-process modal: a valid github
 * URL + 6-digit TOTP submits through the add mutation; an invalid URL and a
 * short TOTP surface their Zod validation messages instead of calling the
 * mutation. useAddMarketplace is mocked so no network is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';

const mutateAsync = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useMarketplace', () => ({
  useAddMarketplace: () => ({ mutateAsync, isPending: false }),
}));

import { MarketplaceAddModal } from '../MarketplaceAddModal';

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

describe('MarketplaceAddModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <MarketplaceAddModal open={false} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('submits a valid github URL + TOTP through the add mutation and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<MarketplaceAddModal open onClose={onClose} />);

    await user.type(
      screen.getByPlaceholderText('https://github.com/owner/repo'),
      'https://github.com/datasharingframework/dsf',
    );
    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: /add process/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      gitUrl: 'https://github.com/datasharingframework/dsf',
      status: 'APPROVED',
      totpCode: '123456',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the invalid-url message and does not call the mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MarketplaceAddModal open onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText('https://github.com/owner/repo'), 'not-a-url');
    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: /add process/i }));

    expect(await screen.findByText(/must be a https:\/\/github\.com/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows the totpDigitsRequired message for a short code', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MarketplaceAddModal open onClose={() => {}} />);

    await user.type(
      screen.getByPlaceholderText('https://github.com/owner/repo'),
      'https://github.com/datasharingframework/dsf',
    );
    await user.type(screen.getByPlaceholderText('000000'), '123');
    await user.click(screen.getByRole('button', { name: /add process/i }));

    expect(await screen.findByText(/6 digits required/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
