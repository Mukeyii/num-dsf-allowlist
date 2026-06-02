import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useCertificates', () => ({
  useCreateCertificate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

import { CertificateModal } from '../CertificateModal';

describe('CertificateModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <CertificateModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and the PEM field when open', () => {
    renderWithProviders(<CertificateModal open onClose={() => {}} instanceId="i1" />);
    expect(screen.getByRole('heading', { name: /add new certificate/i })).toBeInTheDocument();
    expect(screen.getAllByText(/certificate pem/i).length).toBeGreaterThan(0);
  });

  it('shows a validation error when submitting empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CertificateModal open onClose={() => {}} instanceId="i1" />);
    await user.click(screen.getByRole('button', { name: /save & parse/i }));
    expect(await screen.findByText(/certificate pem is required/i)).toBeInTheDocument();
  });
});
