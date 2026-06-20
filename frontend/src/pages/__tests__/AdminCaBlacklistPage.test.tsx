/**
 * AdminCaBlacklistPage.test.tsx — admin CA-blacklist manager. caBlacklistApi
 * is mocked with one blacklist row; asserts the title, the mocked row's DN,
 * and that add includes the 6-digit TOTP step-up code in its request.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn().mockResolvedValue({ data: { data: { id: 'new' } } }),
}));

vi.mock('../../api/caBlacklist.api', () => ({
  caBlacklistApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        data: {
          blacklist: [
            {
              id: 'b1',
              subject_dn: 'CN=Bad CA',
              fingerprint: null,
              reason: 'compromised',
              added_by: 'admin@example.com',
              added_at: '2026-01-01T00:00:00Z',
            },
          ],
          knownCas: [],
        },
      },
    }),
    add: addMock,
    remove: vi.fn(),
  },
}));

import { AdminCaBlacklistPage } from '../AdminCaBlacklistPage';
import { caBlacklistApi } from '../../api/caBlacklist.api';

describe('AdminCaBlacklistPage', () => {
  it('renders the title and a blacklisted CA row', async () => {
    renderWithProviders(<AdminCaBlacklistPage />);
    expect(screen.getByRole('heading', { name: 'CA Blacklist' })).toBeInTheDocument();
    expect(await screen.findByText('CN=Bad CA')).toBeInTheDocument();
  });

  it('disables add until a 6-digit TOTP code is entered, then sends it', async () => {
    addMock.mockClear();
    renderWithProviders(<AdminCaBlacklistPage />);
    await screen.findByText('CN=Bad CA');

    const subjectInput = screen.getByTestId('ca-blacklist-subject-input');
    const totpInput = screen.getByTestId('ca-blacklist-totp-input');
    const addBtn = screen.getByTestId('ca-blacklist-add-btn') as HTMLButtonElement;

    fireEvent.change(subjectInput, { target: { value: 'CN=New CA,O=Test,C=DE' } });
    // Without a TOTP code the add button stays disabled.
    expect(addBtn).toBeDisabled();

    fireEvent.change(totpInput, { target: { value: '123456' } });
    expect(addBtn).not.toBeDisabled();

    fireEvent.click(addBtn);

    await waitFor(() =>
      expect(caBlacklistApi.add).toHaveBeenCalledWith(
        expect.objectContaining({ subjectDn: 'CN=New CA,O=Test,C=DE', totpCode: '123456' }),
      ),
    );
  });
});
