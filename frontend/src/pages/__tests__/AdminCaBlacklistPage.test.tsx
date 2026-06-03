/**
 * AdminCaBlacklistPage.test.tsx — admin CA-blacklist manager. caBlacklistApi
 * is mocked with one blacklist row; asserts the title and the mocked row's DN.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

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
    add: vi.fn(),
    remove: vi.fn(),
  },
}));

import { AdminCaBlacklistPage } from '../AdminCaBlacklistPage';

describe('AdminCaBlacklistPage', () => {
  it('renders the title and a blacklisted CA row', async () => {
    renderWithProviders(<AdminCaBlacklistPage />);
    expect(screen.getByRole('heading', { name: 'CA Blacklist' })).toBeInTheDocument();
    expect(await screen.findByText('CN=Bad CA')).toBeInTheDocument();
  });
});
