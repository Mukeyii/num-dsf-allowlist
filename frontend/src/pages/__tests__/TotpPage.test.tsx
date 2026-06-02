/**
 * TotpPage.test.tsx — renders the TOTP code step for subsequent logins.
 * tempToken comes from router location state; authApi is mocked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api/auth.api', () => ({
  authApi: {
    verifyTotp: vi.fn().mockResolvedValue({ data: { data: { accessToken: 'x' } } }),
  },
}));

import { TotpPage } from '../TotpPage';

describe('TotpPage', () => {
  it('renders the two-factor heading and a code input', () => {
    renderWithProviders(<TotpPage />, {
      route: { pathname: '/totp', state: { tempToken: 'temp-123' } },
    });
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
