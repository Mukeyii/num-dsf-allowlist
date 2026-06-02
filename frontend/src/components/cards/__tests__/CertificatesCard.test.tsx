/**
 * CertificatesCard.test.tsx — renders a certificate row (subject) and opens the
 * certificate-add modal when the add control is clicked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useModals } from '../../../hooks/useModals';

vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => ({
    data: [{ id: 'cert1', subject: 'CN=ukm.de', thumbprint: 'AB12', valid_until: '2027-01-01' }],
    isLoading: false,
  }),
  useDeleteCertificate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { identifier: 'ukm.de' }, isLoading: false }),
}));

import { CertificatesCard } from '../CertificatesCard';

describe('CertificatesCard', () => {
  it('renders a certificate row with its subject', () => {
    renderWithProviders(<CertificatesCard instanceId="i1" />);
    expect(screen.getByText('CN=ukm.de')).toBeInTheDocument();
  });

  it('opens the certificate-add modal when Add is clicked', async () => {
    renderWithProviders(<CertificatesCard instanceId="i1" />);
    await userEvent.click(screen.getByText('+ Add'));
    expect(useModals.getState().open).toBe('certificate-add');
  });
});
