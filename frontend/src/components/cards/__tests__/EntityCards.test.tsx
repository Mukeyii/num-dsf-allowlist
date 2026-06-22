/**
 * EntityCards.test.tsx — consolidated coverage for the five entity cards
 * (Organization, Contacts, Endpoints, Certificates, Memberships). Each card's
 * data hooks are mocked as vi.fn() so individual tests can vary the returned
 * rows; assertions check the real rendered fields/rows, the empty state, the
 * status/badge branches, and at least one interaction per card (FK-highlight,
 * add-modal, or edit-modal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useModals } from '../../../hooks/useModals';
import { useCanvasStore } from '../../../stores/canvas.store';

// --- Hook mocks (filled per test via mockReturnValue) ---------------------
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: vi.fn(),
  useUpdateOrganization: vi.fn(),
}));
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: vi.fn(),
  useDeleteContact: vi.fn(),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: vi.fn(),
  useDeleteEndpoint: vi.fn(),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: vi.fn(),
  useDeleteCertificate: vi.fn(),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: vi.fn(),
  useDeleteMembership: vi.fn(),
}));
vi.mock('../../../hooks/useApproval', () => ({
  useApprovalStatus: vi.fn(),
  useApprovalHistory: vi.fn(),
}));

import { useOrganization, useUpdateOrganization } from '../../../hooks/useOrganization';
import { useContacts, useDeleteContact } from '../../../hooks/useContacts';
import { useEndpoints, useDeleteEndpoint } from '../../../hooks/useEndpoints';
import { useCertificates, useDeleteCertificate } from '../../../hooks/useCertificates';
import { useMemberships, useDeleteMembership } from '../../../hooks/useMemberships';
import { useApprovalStatus, useApprovalHistory } from '../../../hooks/useApproval';

import { OrganizationCard } from '../OrganizationCard';
import { ContactsCard } from '../ContactsCard';
import { EndpointsCard } from '../EndpointsCard';
import { CertificatesCard } from '../CertificatesCard';
import { MembershipsCard } from '../MembershipsCard';

// Typed mock handles
const mOrg = vi.mocked(useOrganization);
const mUpdateOrg = vi.mocked(useUpdateOrganization);
const mContacts = vi.mocked(useContacts);
const mDeleteContact = vi.mocked(useDeleteContact);
const mEndpoints = vi.mocked(useEndpoints);
const mDeleteEndpoint = vi.mocked(useDeleteEndpoint);
const mCerts = vi.mocked(useCertificates);
const mDeleteCert = vi.mocked(useDeleteCertificate);
const mMemberships = vi.mocked(useMemberships);
const mDeleteMembership = vi.mocked(useDeleteMembership);
const mApprovalStatus = vi.mocked(useApprovalStatus);
const mApprovalHistory = vi.mocked(useApprovalHistory);

// Minimal query-result shapes — cards only read .data / .isLoading.
const ok = (data: unknown) => ({ data, isLoading: false }) as never;
const loading = () => ({ data: undefined, isLoading: true }) as never;
const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  useModals.getState().closeModal();
  useCanvasStore.setState({ highlightedEntity: null });
  // Sensible defaults — individual tests override what they care about.
  mOrg.mockReturnValue(ok({ identifier: 'ukm.de' }));
  mUpdateOrg.mockReturnValue(mut());
  mContacts.mockReturnValue(ok([]));
  mDeleteContact.mockReturnValue(mut());
  mEndpoints.mockReturnValue(ok([]));
  mDeleteEndpoint.mockReturnValue(mut());
  mCerts.mockReturnValue(ok([]));
  mDeleteCert.mockReturnValue(mut());
  mMemberships.mockReturnValue(ok([]));
  mDeleteMembership.mockReturnValue(mut());
  mApprovalStatus.mockReturnValue(ok({ status: 'PENDING' }));
  mApprovalHistory.mockReturnValue(ok([]));
});

describe('OrganizationCard', () => {
  const fullOrg = {
    identifier: 'ukm.de',
    name: 'University Hospital Muenster',
    email: 'org@ukm.de',
    active: true,
    address_line: 'Albert-Schweitzer-Campus 1',
    postal_code: '48149',
    city: 'Muenster',
    country_code: 'DE',
    client_cert_thumbprint: '',
  };

  it('renders identifier, name, email, address and the active + approved pills', () => {
    mOrg.mockReturnValue(ok({ ...fullOrg }));
    mApprovalStatus.mockReturnValue(ok({ status: 'APPROVED' }));
    renderWithProviders(<OrganizationCard instanceId="i1" />);

    expect(screen.getByText('ukm.de')).toBeInTheDocument();
    expect(screen.getByText('University Hospital Muenster')).toBeInTheDocument();
    expect(screen.getByText('org@ukm.de')).toBeInTheDocument();
    expect(screen.getByText('Albert-Schweitzer-Campus 1')).toBeInTheDocument();
    expect(screen.getByText('Muenster · DE')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows the inactive pill and "no request" approval branch', () => {
    mOrg.mockReturnValue(ok({ ...fullOrg, active: false }));
    mApprovalStatus.mockReturnValue(ok({ status: 'none' }));
    renderWithProviders(<OrganizationCard instanceId="i1" />);

    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(screen.getByText('no request')).toBeInTheDocument();
  });

  it('renders the empty state when there is no organization', () => {
    mOrg.mockReturnValue(ok(null));
    renderWithProviders(<OrganizationCard instanceId="i1" />);
    expect(screen.getByText(/No data yet/)).toBeInTheDocument();
  });

  it('opens the org-edit modal when Edit is clicked', async () => {
    mOrg.mockReturnValue(ok({ ...fullOrg }));
    renderWithProviders(<OrganizationCard instanceId="i1" />);
    await userEvent.click(screen.getByText('Edit'));
    expect(useModals.getState().open).toBe('org-edit');
  });
});

describe('ContactsCard', () => {
  it('renders contact rows with type badges and both email-validation branches', () => {
    mContacts.mockReturnValue(
      ok([
        { id: 'c1', name: 'Dr. Alice', email: 'a@ukm.de', types: ['MEDIC'], email_validated: true },
        {
          id: 'c2',
          name: 'Bob Admin',
          email: 'b@ukm.de',
          types: ['DSF_ADMIN'],
          email_validated: false,
        },
      ]),
    );
    renderWithProviders(<ContactsCard instanceId="i1" />);

    expect(screen.getByText('Dr. Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob Admin')).toBeInTheDocument();
    expect(screen.getByText('MEDIC')).toBeInTheDocument();
    expect(screen.getByText('DSF_ADMIN')).toBeInTheDocument();
    expect(screen.getByText('✓ validated')).toBeInTheDocument();
    expect(screen.getByText('⚠ not validated')).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    mContacts.mockReturnValue(ok([]));
    renderWithProviders(<ContactsCard instanceId="i1" />);
    expect(screen.getByText('No data yet.')).toBeInTheDocument();
  });

  it('opens the contact-add modal when Add is clicked', async () => {
    renderWithProviders(<ContactsCard instanceId="i1" />);
    await userEvent.click(screen.getByText('+ Add'));
    expect(useModals.getState().open).toBe('contact-add');
  });

  it('highlights the organization card when the FK link is clicked', async () => {
    renderWithProviders(<ContactsCard instanceId="i1" />);
    await userEvent.click(screen.getByText('ukm.de'));
    expect(useCanvasStore.getState().highlightedEntity).toBe('organization');
  });
});

describe('EndpointsCard', () => {
  it('renders an endpoint row with its address and FHIR/BPE-flagged IPs', () => {
    mEndpoints.mockReturnValue(
      ok([
        {
          identifier: 'fhir.ukm.de',
          name: 'UKM FHIR',
          address: 'https://fhir.ukm.de/fhir',
          ipAddresses: [{ id: 'ip1', ip: '10.0.0.1', isFhir: true, isBpe: true }],
        },
      ]),
    );
    renderWithProviders(<EndpointsCard instanceId="i1" />);

    expect(screen.getByText('UKM FHIR')).toBeInTheDocument();
    expect(screen.getByText('fhir.ukm.de')).toBeInTheDocument();
    expect(screen.getByText('https://fhir.ukm.de/fhir')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    mEndpoints.mockReturnValue(ok([]));
    renderWithProviders(<EndpointsCard instanceId="i1" />);
    expect(screen.getByText('No data yet.')).toBeInTheDocument();
  });

  it('opens the endpoint-edit modal for a row when its edit control is clicked', async () => {
    mEndpoints.mockReturnValue(
      ok([{ identifier: 'fhir.ukm.de', name: 'UKM FHIR', address: 'https://x', ipAddresses: [] }]),
    );
    renderWithProviders(<EndpointsCard instanceId="i1" />);
    await userEvent.click(screen.getByLabelText(/edit/i));
    expect(useModals.getState().open).toBe('endpoint-edit');
    expect(useModals.getState().editId).toBe('fhir.ukm.de');
  });
});

describe('CertificatesCard', () => {
  it('renders a certificate row with subject, active badge and days-left', () => {
    const farFuture = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
    mCerts.mockReturnValue(ok([{ id: 'cert1', subject: 'CN=ukm.de', valid_until: farFuture }]));
    renderWithProviders(<CertificatesCard instanceId="i1" />);

    expect(screen.getByText('CN=ukm.de')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText(/\dd left/)).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    mCerts.mockReturnValue(ok([]));
    renderWithProviders(<CertificatesCard instanceId="i1" />);
    expect(screen.getByText('No data yet.')).toBeInTheDocument();
  });

  it('shows the loading indicator while certificates are loading', () => {
    mCerts.mockReturnValue(loading());
    renderWithProviders(<CertificatesCard instanceId="i1" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('opens the cert-renew modal when the renew control is clicked', async () => {
    renderWithProviders(<CertificatesCard instanceId="i1" />);
    await userEvent.click(screen.getByText('Renew'));
    expect(useModals.getState().open).toBe('cert-renew');
  });
});

describe('MembershipsCard', () => {
  it('renders a membership row with parent organization and roles', () => {
    mMemberships.mockReturnValue(
      ok([{ id: 'm1', parent_organization: 'num.de', roles: ['DIC', 'HRP'] }]),
    );
    mEndpoints.mockReturnValue(ok([{ identifier: 'fhir.ukm.de' }]));
    renderWithProviders(<MembershipsCard instanceId="i1" />);

    expect(screen.getByText('num.de')).toBeInTheDocument();
    expect(screen.getByText(/DIC/)).toBeInTheDocument();
    expect(screen.getByText(/HRP/)).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    mMemberships.mockReturnValue(ok([]));
    renderWithProviders(<MembershipsCard instanceId="i1" />);
    expect(screen.getByText('No data yet.')).toBeInTheDocument();
  });

  it('opens the membership-add modal when Add is clicked', async () => {
    renderWithProviders(<MembershipsCard instanceId="i1" />);
    await userEvent.click(screen.getByText('+ Add'));
    expect(useModals.getState().open).toBe('membership-add');
  });

  it('opens the membership-edit modal for a row when its edit control is clicked', async () => {
    mMemberships.mockReturnValue(ok([{ id: 'm1', parent_organization: 'num.de', roles: ['DIC'] }]));
    renderWithProviders(<MembershipsCard instanceId="i1" />);
    await userEvent.click(screen.getByLabelText(/edit/i));
    expect(useModals.getState().open).toBe('membership-edit');
    expect(useModals.getState().editId).toBe('m1');
  });
});
