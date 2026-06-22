/**
 * AppPage.interactions.test.tsx — interaction wiring of the authenticated shell.
 *
 * Distinct from any render smoke test: it drives the REAL useModals and
 * useCanvasStore Zustand stores while stubbing the heavy layout/canvas/modal
 * children, then asserts (1) a TopBar action opens the matching modal via
 * useModals, (2) switching the active instance re-renders the canvas and
 * refetches the organization for the new id, and (3) the canvas highlight
 * wiring sets useCanvasStore.highlightedEntity.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useModals } from '../../hooks/useModals';
import { useCanvasStore } from '../../stores/canvas.store';

// Data hooks: keep them inert so no network is touched. useOrganization is a
// spy so we can assert it is re-invoked with the switched instance id.
vi.mock('../../hooks/useInstance', () => ({
  useInstances: vi.fn(() => ({ data: [], isLoading: false })),
}));
const useOrganizationMock = vi.fn((_id: string | null) => ({ data: undefined }));
vi.mock('../../hooks/useOrganization', () => ({
  useOrganization: (id: string | null) => useOrganizationMock(id),
}));

// Heavy children become lightweight stubs. TopBar exposes its action callbacks
// as buttons; EntityCanvas exposes a button that fires the highlight wiring.
vi.mock('../../components/layout/Sidebar', () => ({ Sidebar: () => <div /> }));
vi.mock('../../components/layout/RightPanel', () => ({ RightPanel: () => <div /> }));
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

vi.mock('../../components/layout/TopBar', () => ({
  TopBar: ({ onDownload, onApproval }: { onDownload: () => void; onApproval: () => void }) => (
    <div>
      <button onClick={onDownload}>topbar-download</button>
      <button onClick={onApproval}>topbar-approval</button>
    </div>
  ),
}));

vi.mock('../../components/canvas/EntityCanvas', () => ({
  EntityCanvas: ({ instanceId }: { instanceId: string }) => {
    const highlightEntity = useCanvasStore((s) => s.highlightEntity);
    return (
      <div>
        <span>canvas-for:{instanceId}</span>
        <button onClick={() => highlightEntity('contacts')}>highlight-contacts</button>
      </div>
    );
  },
}));

// Modal stubs expose their `open` prop so we can assert which one is shown.
function modalStub(label: string) {
  return ({ open }: { open: boolean }) => (open ? <div>{label}-open</div> : null);
}
vi.mock('../../components/modals/OrganizationModal', () => ({
  OrganizationModal: modalStub('org'),
}));
vi.mock('../../components/modals/ContactModal', () => ({ ContactModal: modalStub('contact') }));
vi.mock('../../components/modals/EndpointModal', () => ({ EndpointModal: modalStub('endpoint') }));
vi.mock('../../components/modals/CertificateModal', () => ({
  CertificateModal: modalStub('certificate'),
}));
vi.mock('../../components/modals/MembershipModal', () => ({
  MembershipModal: modalStub('membership'),
}));
vi.mock('../../components/modals/ApprovalModal', () => ({ ApprovalModal: modalStub('approval') }));
vi.mock('../../components/modals/DownloadModal', () => ({ DownloadModal: modalStub('download') }));
vi.mock('../../components/modals/CertRenewalModal', () => ({
  CertRenewalModal: modalStub('cert-renew'),
}));

import { AppPage } from '../AppPage';

function resetStores() {
  act(() => {
    useModals.getState().closeModal();
    useCanvasStore.setState({ activeInstanceId: null, highlightedEntity: null });
  });
}

describe('AppPage interactions', () => {
  beforeEach(() => {
    useOrganizationMock.mockClear();
    resetStores();
  });
  afterEach(() => {
    resetStores();
  });

  it('opens the download modal via the TopBar action (useModals state)', () => {
    act(() => {
      useCanvasStore.setState({ activeInstanceId: 'inst-1' });
    });
    renderWithProviders(<AppPage />, { route: '/app' });

    // No modal open initially.
    expect(screen.queryByText('download-open')).not.toBeInTheDocument();
    expect(useModals.getState().open).toBeNull();

    fireEvent.click(screen.getByText('topbar-download'));

    expect(useModals.getState().open).toBe('download');
    expect(screen.getByText('download-open')).toBeInTheDocument();

    // A second action swaps the open modal (download → approval).
    fireEvent.click(screen.getByText('topbar-approval'));
    expect(useModals.getState().open).toBe('approval');
    expect(screen.queryByText('download-open')).not.toBeInTheDocument();
    expect(screen.getByText('approval-open')).toBeInTheDocument();
  });

  it('re-renders the canvas and refetches the organization when the active instance changes', () => {
    renderWithProviders(<AppPage />, { route: '/app' });

    // No active instance yet → placeholder, no canvas, org fetched with null.
    expect(screen.getByText('Loading instance…')).toBeInTheDocument();
    expect(screen.queryByText(/canvas-for:/)).not.toBeInTheDocument();
    expect(useOrganizationMock).toHaveBeenCalledWith(null);

    act(() => {
      useCanvasStore.getState().setActiveInstance('inst-42');
    });

    // Canvas now renders for the switched instance and the org refetch ran for it.
    expect(screen.getByText('canvas-for:inst-42')).toBeInTheDocument();
    expect(screen.queryByText('Loading instance…')).not.toBeInTheDocument();
    expect(useOrganizationMock).toHaveBeenCalledWith('inst-42');
  });

  it('fires the canvas highlight wiring (sets highlightedEntity)', () => {
    act(() => {
      useCanvasStore.setState({ activeInstanceId: 'inst-1' });
    });
    renderWithProviders(<AppPage />, { route: '/app' });

    expect(useCanvasStore.getState().highlightedEntity).toBeNull();

    fireEvent.click(screen.getByText('highlight-contacts'));

    expect(useCanvasStore.getState().highlightedEntity).toBe('contacts');
  });
});
