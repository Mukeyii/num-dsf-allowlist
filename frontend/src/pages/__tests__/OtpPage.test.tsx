/**
 * OtpPage.test.tsx — renders the 6-digit code step. Email comes from router
 * location state (passed via the initial entry). authApi is mocked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api/auth.api', () => ({
  authApi: {
    requestOtp: vi.fn().mockResolvedValue({}),
    verifyOtp: vi
      .fn()
      .mockResolvedValue({ data: { data: { tempToken: 't', requiresTotpSetup: false } } }),
  },
}));

import { OtpPage } from '../OtpPage';

describe('OtpPage', () => {
  it('renders the code-entry heading and six digit inputs', () => {
    renderWithProviders(<OtpPage />, {
      route: { pathname: '/otp', state: { email: 'admin@example.com' } },
    });
    expect(screen.getByText('Enter your code')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });
});
