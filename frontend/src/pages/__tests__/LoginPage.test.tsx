/**
 * LoginPage.test.tsx — renders the email step; the email field and submit
 * button are visible. authApi is mocked so nothing hits the network.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api/auth.api', () => ({
  authApi: {
    requestOtp: vi.fn().mockResolvedValue({}),
    clientCertLogin: vi.fn().mockResolvedValue({ data: { data: { accessToken: 'x' } } }),
  },
}));

import { LoginPage } from '../LoginPage';

describe('LoginPage', () => {
  it('renders the email label and the email input', () => {
    renderWithProviders(<LoginPage />, { route: '/login' });
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send code →' })).toBeInTheDocument();
  });
});
