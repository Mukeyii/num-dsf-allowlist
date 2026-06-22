/**
 * BundlePreview.test.tsx — collapsed toggle shows the FHIR resource count, and
 * expanding reveals the organization, endpoint (with IP flags), certificate and
 * affiliation sections with their real values. Also covers the null render when
 * no organization is loaded yet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';

const orgMock = vi.fn();
const endpointsMock = vi.fn();
const certsMock = vi.fn();
const membershipsMock = vi.fn();

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => orgMock(),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => endpointsMock(),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => certsMock(),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => membershipsMock(),
}));

import { BundlePreview } from '../BundlePreview';

const ORG = { name: 'University Hospital Muenster', identifier: 'ukm.de' };
const ENDPOINTS = [
  {
    identifier: 'fhir.ukm.de',
    name: 'UKM FHIR Endpoint',
    address: 'https://fhir.ukm.de/fhir',
    ipAddresses: [
      { ip: '10.0.0.1', isFhir: true, isBpe: false },
      { ip: '10.0.0.2', isFhir: false, isBpe: true },
    ],
  },
];
const CERTS = [{ id: 'cert1', subject: 'CN=ukm.de', valid_until: '2027-01-01' }];
const MEMBERSHIPS = [{ id: 'm1', parent_organization: 'num.de', roles: ['DIC', 'HRP'] }];

beforeEach(() => {
  orgMock.mockReturnValue({ data: ORG });
  endpointsMock.mockReturnValue({ data: ENDPOINTS });
  certsMock.mockReturnValue({ data: CERTS });
  membershipsMock.mockReturnValue({ data: MEMBERSHIPS });
});

describe('BundlePreview', () => {
  it('renders nothing until the organization has loaded', () => {
    orgMock.mockReturnValue({ data: undefined });
    const { container } = renderWithProviders(<BundlePreview instanceId="i1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the collapsed toggle with the total resource count', () => {
    renderWithProviders(<BundlePreview instanceId="i1" />);
    // 1 org + 1 endpoint + 1 cert + 1 membership = 4 resources. The label is
    // split across text nodes inside the button, so match the whole button.
    expect(
      screen.getByRole('button', { name: /Preview Bundle \(4 resources\)/ }),
    ).toBeInTheDocument();
    // Sections are hidden while collapsed.
    expect(screen.queryByText('University Hospital Muenster')).not.toBeInTheDocument();
  });

  it('expands to reveal organization, endpoint, certificate and affiliation sections', async () => {
    renderWithProviders(<BundlePreview instanceId="i1" />);
    await userEvent.click(screen.getByRole('button', { name: /Preview Bundle/ }));

    // Toggle label flips to Hide once expanded.
    expect(
      await screen.findByRole('button', { name: /Hide Bundle/ }, { timeout: 4000 }),
    ).toBeInTheDocument();

    // Organization section.
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('University Hospital Muenster')).toBeInTheDocument();
    expect(screen.getByText('ukm.de')).toBeInTheDocument();

    // Endpoint section, with name, address and IP-flag pills.
    expect(screen.getByText('Endpoint')).toBeInTheDocument();
    expect(screen.getByText('UKM FHIR Endpoint')).toBeInTheDocument();
    expect(screen.getByText('https://fhir.ukm.de/fhir')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1 F')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.2 B')).toBeInTheDocument();

    // Certificate section, including the localized valid-until line.
    expect(screen.getByText('Certificate')).toBeInTheDocument();
    expect(screen.getByText('CN=ukm.de')).toBeInTheDocument();
    expect(screen.getByText('Valid until: 2027-01-01')).toBeInTheDocument();

    // Affiliation (membership) section with parent org and each role.
    expect(screen.getByText('Affiliation')).toBeInTheDocument();
    expect(screen.getByText('num.de')).toBeInTheDocument();
    expect(screen.getByText('DIC')).toBeInTheDocument();
    expect(screen.getByText('HRP')).toBeInTheDocument();
  });

  it('counts only the organization when no child resources exist', () => {
    endpointsMock.mockReturnValue({ data: [] });
    certsMock.mockReturnValue({ data: [] });
    membershipsMock.mockReturnValue({ data: [] });
    renderWithProviders(<BundlePreview instanceId="i1" />);
    expect(
      screen.getByRole('button', { name: /Preview Bundle \(1 resources\)/ }),
    ).toBeInTheDocument();
  });
});
