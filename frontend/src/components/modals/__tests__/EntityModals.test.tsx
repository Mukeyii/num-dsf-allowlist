/**
 * EntityModals.test.tsx — submit + validation coverage for the three remaining
 * low-coverage entity modals: CertificateModal, EndpointModal, DownloadModal.
 *
 * For each modal: render open via renderWithProviders with the data/mutation
 * hooks mocked (no network), drive the form to a valid submit and assert the
 * right mutation/handler runs with the parsed values, then exercise one
 * inline validation-error path. Closed-state renders nothing.
 *
 * The cross-user guard has no provider here, so its context default runs the
 * action directly — no mock needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';

// ---- shared hoisted mutation/handler spies ---------------------------------
const certCreate = vi.hoisted(() => vi.fn());
const endpointCreate = vi.hoisted(() => vi.fn());
const endpointUpdate = vi.hoisted(() => vi.fn());
const downloadBundle = vi.hoisted(() => vi.fn());
const downloadIp = vi.hoisted(() => vi.fn());

vi.mock('../../../hooks/useCertificates', () => ({
  useCreateCertificate: () => ({ mutateAsync: certCreate, isPending: false }),
}));

const endpointsFixture = [
  {
    identifier: 'ep1',
    name: 'Prod FHIR',
    address: 'https://dsf-fhir.hospital.de/fhir',
    ipAddresses: [],
  },
];
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: endpointsFixture, isLoading: false }),
  useCreateEndpoint: () => ({ mutateAsync: endpointCreate, isPending: false }),
  useUpdateEndpoint: () => ({ mutateAsync: endpointUpdate, isPending: false }),
}));

// BundlePreview pulls in unrelated API state for these tests.
vi.mock('../BundlePreview', () => ({ BundlePreview: () => null }));
vi.mock('../../../api/entities.api', () => ({
  api: () => ({ downloadIpList: downloadIp }),
  downloadFullAllowListBundle: downloadBundle,
}));

import { CertificateModal } from '../CertificateModal';
import { EndpointModal } from '../EndpointModal';
import { DownloadModal } from '../DownloadModal';

// A valid PEM block that contains the required CERTIFICATE markers but no
// private-key material (kept short; not a real key).
const VALID_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'QkFTRTY0Qk9EWQ==',
  '-----END CERTIFICATE-----',
].join('\n');

beforeEach(() => {
  certCreate.mockReset().mockResolvedValue(undefined);
  endpointCreate.mockReset().mockResolvedValue(undefined);
  endpointUpdate.mockReset().mockResolvedValue(undefined);
  downloadBundle.mockReset().mockResolvedValue({ data: '{}' });
  downloadIp.mockReset().mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });
});

describe('CertificateModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <CertificateModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('submits the pasted PEM through the create mutation and closes', async () => {
    const onClose = vi.fn();
    renderWithProviders(<CertificateModal open onClose={onClose} instanceId="i1" />);

    // The PEM field is the only textbox in this modal (Modal renders into a
    // portal on document.body, so query via screen, not the render container).
    const textarea = screen.getByRole('textbox');
    // Atomic change avoids char-by-char races on a multi-line value under load.
    fireEvent.change(textarea, { target: { value: VALID_PEM } });
    fireEvent.click(screen.getByRole('button', { name: /save & parse/i }));

    await waitFor(() => expect(certCreate).toHaveBeenCalledTimes(1));
    expect(certCreate).toHaveBeenCalledWith(VALID_PEM);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the missing-end-marker error and does not call the mutation', async () => {
    renderWithProviders(<CertificateModal open onClose={() => {}} instanceId="i1" />);

    const textarea = screen.getByRole('textbox');
    // Has the BEGIN marker but no END marker → certPemEnd inline error.
    fireEvent.change(textarea, { target: { value: '-----BEGIN CERTIFICATE-----\nQUJD' } });
    fireEvent.click(screen.getByRole('button', { name: /save & parse/i }));

    expect(
      await screen.findByText(/pem must end with/i, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(certCreate).not.toHaveBeenCalled();
  });
});

describe('EndpointModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <EndpointModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('submits the parsed endpoint fields through the create mutation and closes', async () => {
    const onClose = vi.fn();
    renderWithProviders(<EndpointModal open onClose={onClose} instanceId="i1" />);

    fireEvent.change(screen.getByTestId('endpoint-identifier-input'), {
      target: { value: 'dsf-fhir.hospital.de' },
    });
    fireEvent.change(screen.getByPlaceholderText(/dsf-fhir\.hospital\.de\/fhir/i), {
      target: { value: 'https://dsf-fhir.hospital.de/fhir' },
    });
    fireEvent.change(screen.getByPlaceholderText(/128\.176\.232\.132/), {
      target: { value: '128.176.232.132' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add endpoint/i }));

    await waitFor(() => expect(endpointCreate).toHaveBeenCalledTimes(1));
    expect(endpointCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'dsf-fhir.hospital.de',
        address: 'https://dsf-fhir.hospital.de/fhir',
        ipAddresses: [expect.objectContaining({ ip: '128.176.232.132' })],
      }),
    );
    expect(endpointUpdate).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the invalid-FQDN error and does not call the mutation', async () => {
    renderWithProviders(<EndpointModal open onClose={() => {}} instanceId="i1" />);

    fireEvent.change(screen.getByTestId('endpoint-identifier-input'), {
      target: { value: 'not a fqdn' },
    });
    fireEvent.change(screen.getByPlaceholderText(/dsf-fhir\.hospital\.de\/fhir/i), {
      target: { value: 'https://dsf-fhir.hospital.de/fhir' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add endpoint/i }));

    expect(
      await screen.findByText(/must be a valid fqdn/i, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(endpointCreate).not.toHaveBeenCalled();
  });
});

describe('DownloadModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <DownloadModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps downloads gated until the disclaimer is acknowledged, then triggers the bundle download', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DownloadModal open onClose={() => {}} instanceId="i1" />);

    const bundleBtn = screen.getByTestId('download-bundle-btn');
    // Validation/gate path: button is disabled before acknowledgment.
    expect(bundleBtn).toBeDisabled();
    expect(screen.getByTestId('download-ip-btn')).toBeDisabled();

    await user.click(screen.getByTestId('disclaimer-checkbox'));
    expect(bundleBtn).toBeEnabled();

    await user.click(bundleBtn);
    await waitFor(() => expect(downloadBundle).toHaveBeenCalledTimes(1));
  });
});
