/**
 * AppPage.render.test.tsx — render coverage for the authenticated shell layout.
 *
 * Complements AppPage.interactions.test.tsx (which stubs EntityCanvas/RightPanel
 * and drives the store/modal wiring). Here the REAL EntityCanvas and REAL
 * RightPanel render against mocked leaf data hooks, so the assertions verify the
 * actual three-column entity graph: the six entities (Organization, Contacts,
 * Endpoints, Certificates, Memberships card titles + the Approval-Status right
 * panel) for a selected instance, and the placeholder for the empty / no-active
 * -instance branch. The chrome children (Sidebar, TopBar, banners, floating
 * widgets) are stubbed so nothing reaches the network or the auth API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useCanvasStore } from '../../stores/canvas.store';
import { useModals } from '../../hooks/useModals';

// --- Leaf data hooks (the entity cards + right panel read these) -----------
vi.mock('../../hooks/useInstance', () => ({
  useInstances: vi.fn(() => ({ data: [], isLoading: false })),
  useInstance: vi.fn(() => ({ data: undefined })),
}));
vi.mock('../../hooks/useOrganization', () => ({
  useOrganization: vi.fn(() => ({ data: { identifier: 'ukm.de' }, isLoading: false })),
  useUpdateOrganization: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));
vi.mock('../../hooks/useContacts', () => ({
  useContacts: vi.fn(() => ({ data: [] })),
  useDeleteContact: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('../../hooks/useEndpoints', () => ({
  useEndpoints: vi.fn(() => ({ data: [] })),
  useDeleteEndpoint: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('../../hooks/useCertificates', () => ({
  useCertificates: vi.fn(() => ({ data: [] })),
  useDeleteCertificate: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('../../hooks/useMemberships', () => ({
  useMemberships: vi.fn(() => ({ data: [] })),
  useDeleteMembership: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('../../hooks/useApproval', () => ({
  useApprovalStatus: vi.fn(() => ({ data: { status: 'PENDING' } })),
  useApprovalHistory: vi.fn(() => ({ data: [] })),
}));

// --- Shell chrome + floating widgets: inert stubs (no network / auth API) ---
vi.mock('../../components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));
vi.mock('../../components/layout/TopBar', () => ({ TopBar: () => <div data-testid="topbar" /> }));
vi.mock('../../components/layout/Breadcrumbs', () => ({ Breadcrumbs: () => <div /> }));
vi.mock('../../components/layout/AppFooter', () => ({ AppFooter: () => <div /> }));
vi.mock('../../components/layout/ExpiryWarningBanner', () => ({
  ExpiryWarningBanner: () => <div />,
}));
vi.mock('../../components/layout/CrossUserInstanceBanner', () => ({
  CrossUserInstanceBanner: () => <div />,
}));
vi.mock('../../components/layout/CommandPalette', () => ({ CommandPalette: () => <div /> }));
vi.mock('../../components/map/MapHeader', () => ({ MapHeader: () => <div /> }));
vi.mock('../../components/canvas/ActivityFeed', () => ({ ActivityFeed: () => <div /> }));
// OnboardingWizard reads all entity hooks too; the entity cards already cover
// it — keep it out of the way so the card assertions stay unambiguous.
vi.mock('../../components/canvas/OnboardingWizard', () => ({
  OnboardingWizard: () => <div />,
}));
// ExpiryTimeline only renders when certs exist (empty here) — leave it real.

// Modal stubs: render nothing so they never duplicate card text. The factories
// are hoisted above all top-level code, so each returns its stub inline.
vi.mock('../../components/modals/OrganizationModal', () => ({ OrganizationModal: () => null }));
vi.mock('../../components/modals/ContactModal', () => ({ ContactModal: () => null }));
vi.mock('../../components/modals/EndpointModal', () => ({ EndpointModal: () => null }));
vi.mock('../../components/modals/CertificateModal', () => ({ CertificateModal: () => null }));
vi.mock('../../components/modals/MembershipModal', () => ({ MembershipModal: () => null }));
vi.mock('../../components/modals/ApprovalModal', () => ({ ApprovalModal: () => null }));
vi.mock('../../components/modals/DownloadModal', () => ({ DownloadModal: () => null }));
vi.mock('../../components/modals/CertRenewalModal', () => ({ CertRenewalModal: () => null }));

import { AppPage } from '../AppPage';

function resetStores() {
  act(() => {
    useModals.getState().closeModal();
    useCanvasStore.setState({ activeInstanceId: null, highlightedEntity: null });
  });
}

describe('AppPage render', () => {
  beforeEach(() => {
    // AppPage's resize effect hides the right panel below 1200px; jsdom defaults
    // to 1024, so widen the viewport to keep the three-column layout mounted.
    window.innerWidth = 1300;
    resetStores();
  });

  it('renders the three-column entity graph (six entities + right panel) for a selected instance', () => {
    act(() => {
      useCanvasStore.setState({ activeInstanceId: 'inst-1' });
    });
    renderWithProviders(<AppPage />, { route: '/app' });

    // EntityCanvas renders the five entity cards, each wrapped in a #card-<id>
    // container — assert by id so the title text can't be confused with text
    // elsewhere in the shell.
    for (const id of [
      'card-organization',
      'card-contacts',
      'card-endpoints',
      'card-memberships',
      'card-certificates',
    ]) {
      expect(document.getElementById(id)).not.toBeNull();
    }

    // The card titles render their real (English) labels.
    expect(screen.getByRole('heading', { name: 'Organization' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Endpoints' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Memberships' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Certificates' })).toBeInTheDocument();

    // The sixth entity (Approval) lives in the RightPanel, which also renders
    // for the canvas route — its heading completes the six-entity overview.
    expect(screen.getByRole('heading', { name: /approval status/i })).toBeInTheDocument();

    // The placeholder must NOT show when an instance is active.
    expect(screen.queryByText('Loading instance…')).not.toBeInTheDocument();
  });

  it('renders the placeholder and no entity cards when no instance is active', () => {
    renderWithProviders(<AppPage />, { route: '/app' });

    // The empty branch shows its placeholder in place of the EntityCanvas.
    expect(screen.getByText('Loading instance…')).toBeInTheDocument();

    // With no active instance the canvas is not mounted, so none of the entity
    // card containers exist.
    expect(document.getElementById('card-organization')).toBeNull();
    expect(document.getElementById('card-contacts')).toBeNull();
    expect(document.getElementById('card-certificates')).toBeNull();

    // The right panel still mounts for the canvas route (it shows empty counts),
    // so its approval-status heading remains present.
    expect(screen.getByRole('heading', { name: /approval status/i })).toBeInTheDocument();
  });
});
