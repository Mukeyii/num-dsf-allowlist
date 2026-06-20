/**
 * CertRenewalModal.test.tsx — covers the guided renewal flow: select an
 * expiring cert, paste a new PEM, review and confirm → the renew mutation fires
 * with { certId, pem }. A pasted PRIVATE KEY surfaces the rejection notice and
 * keeps the Review button disabled. useCertificates / useRenewCertificate are
 * mocked so no network is touched; the default cross-user guard runs the action
 * directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';

const mutateAsync = vi.hoisted(() => vi.fn());
const certs = vi.hoisted(() => [{ id: 'cert-1', subject: 'CN=ukm.de', valid_until: '2026-07-01' }]);
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => ({ data: certs }),
  useRenewCertificate: () => ({ mutateAsync, isPending: false }),
}));

import { CertRenewalModal } from '../CertRenewalModal';

const PUBLIC_PEM = '-----BEGIN CERTIFICATE-----\nMIIPUBLIC...\n-----END CERTIFICATE-----';

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

describe('CertRenewalModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <CertRenewalModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('walks select → upload → confirm and renews with { certId, pem }', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<CertRenewalModal open onClose={onClose} instanceId="i1" />);

    // Step 1: pick the expiring cert (button shows its subject).
    await user.click(screen.getByRole('button', { name: /CN=ukm\.de/ }));

    // Step 2: paste a public PEM, then Review.
    await user.type(screen.getByPlaceholderText(/paste PEM content/i), PUBLIC_PEM);
    await user.click(screen.getByRole('button', { name: /^review$/i }));

    // Step 3: confirm the swap.
    await user.click(screen.getByRole('button', { name: /confirm renewal/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({ certId: 'cert-1', pem: PUBLIC_PEM });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('surfaces the private-key rejection and disables Review', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CertRenewalModal open onClose={() => {}} instanceId="i1" />);

    await user.click(screen.getByRole('button', { name: /CN=ukm\.de/ }));
    // The modal flags any pasted PEM whose text contains a private-key block.
    // A short marker exercises that guard without embedding a scanner-tripping
    // key block (and keeps the keystroke count low so the assertion is stable).
    await user.type(
      screen.getByPlaceholderText(/paste PEM content/i),
      'oops, this still has a PRIVATE KEY',
    );

    // The warning is reactive on the textarea value; under heavy parallel load
    // (full suite + coverage) it can mount a beat after the last keystroke
    // flushes, so wait with a generous timeout rather than the default 1s.
    expect(
      await screen.findByText(/contains a PRIVATE KEY/i, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^review$/i })).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
