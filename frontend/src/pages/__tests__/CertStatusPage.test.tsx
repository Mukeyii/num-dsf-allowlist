import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { CertStatusPage } from '../CertStatusPage';

describe('CertStatusPage', () => {
  it('shows the not-registered message for CERT_NOT_REGISTERED', () => {
    renderWithProviders(<CertStatusPage code="CERT_NOT_REGISTERED" />);
    expect(screen.getByText(/not in the allow-list/i)).toBeInTheDocument();
  });

  it('shows the checking state when code is null', () => {
    renderWithProviders(<CertStatusPage code={null} />);
    expect(screen.getByText(/checking your certificate/i)).toBeInTheDocument();
  });

  it('falls back to the generic message for an unknown code', () => {
    renderWithProviders(<CertStatusPage code="WHATEVER" />);
    expect(screen.getByText(/sign-in with your certificate failed/i)).toBeInTheDocument();
  });
});
