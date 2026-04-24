import { useState, useEffect } from 'react';
import { useMatch, Outlet } from 'react-router-dom';
import { useCanvasStore } from '../stores/canvas.store';
import { useInstances } from '../hooks/useInstance';
import { useModals } from '../hooks/useModals';
import { useOrganization } from '../hooks/useOrganization';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { RightPanel } from '../components/layout/RightPanel';
import { EntityCanvas } from '../components/canvas/EntityCanvas';
import { OrganizationModal } from '../components/modals/OrganizationModal';
import { ContactModal } from '../components/modals/ContactModal';
import { EndpointModal } from '../components/modals/EndpointModal';
import { CertificateModal } from '../components/modals/CertificateModal';
import { MembershipModal } from '../components/modals/MembershipModal';
import { ApprovalModal } from '../components/modals/ApprovalModal';
import { DownloadModal } from '../components/modals/DownloadModal';
import { CertRenewalModal } from '../components/modals/CertRenewalModal';
import { ExpiryWarningBanner } from '../components/layout/ExpiryWarningBanner';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { ActivityFeed } from '../components/canvas/ActivityFeed';
import { CommandPalette } from '../components/layout/CommandPalette';

export function AppPage() {
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const isCanvasRoute = useMatch('/app');
  const isMapRoute    = useMatch('/app/map');
  useInstances();

  const { open, editId, openModal, closeModal } = useModals();
  const { data: org } = useOrganization(activeInstanceId);

  const [showSidebar, setShowSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1200) {
        setShowSidebar(false);
        setShowRightPanel(false);
      } else {
        setShowSidebar(true);
        setShowRightPanel(true);
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'var(--bg-page)',
    }}>
      {showSidebar && <Sidebar />}

      {/* Toggle button for left sidebar when hidden */}
      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          style={{
            position: 'fixed', left: 0, top: '50%', zIndex: 30,
            transform: 'translateY(-50%)',
            width: '24px', height: '48px', borderRadius: '0 8px 8px 0',
            border: 'none', background: 'var(--bg-card)', cursor: 'pointer',
            boxShadow: '2px 0 8px var(--shadow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>chevron_right</span>
        </button>
      )}

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginLeft: showSidebar ? '220px' : '0',
        marginRight: showRightPanel && !isMapRoute ? '280px' : '0',
        transition: 'margin 0.2s ease',
      }}>
        <TopBar
          onDownload={() => openModal('download')}
          onApproval={() => openModal('approval')}
        />
        <ExpiryWarningBanner />
        <Breadcrumbs />
        {isCanvasRoute ? (
          activeInstanceId ? (
            <EntityCanvas instanceId={activeInstanceId} />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '14px',
            }}>
              Loading instance…
            </div>
          )
        ) : (
          <Outlet />
        )}
      </div>

      {showRightPanel && !isMapRoute && <RightPanel instanceId={activeInstanceId} />}

      {/* Toggle button for right panel when hidden (not on map route) */}
      {!showRightPanel && !isMapRoute && (
        <button
          onClick={() => setShowRightPanel(true)}
          style={{
            position: 'fixed', right: 0, top: '50%', zIndex: 30,
            transform: 'translateY(-50%)',
            width: '24px', height: '48px', borderRadius: '8px 0 0 8px',
            border: 'none', background: 'var(--bg-card)', cursor: 'pointer',
            boxShadow: '-2px 0 8px var(--shadow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>chevron_left</span>
        </button>
      )}

      <ActivityFeed />
      <CommandPalette />

      {activeInstanceId && (
        <>
          <OrganizationModal
            open={open === 'org-edit'}
            onClose={closeModal}
            instanceId={activeInstanceId}
            defaultValues={org ? {
              identifier: org.identifier,
              name: org.name,
              active: !!org.active,
              email: org.email,
              addressLine: org.address_line || '',
              postalCode: org.postal_code || '',
              city: org.city || '',
              countryCode: org.country_code || '',
              clientCertThumbprint: org.client_cert_thumbprint || '',
            } : undefined}
          />
          <ContactModal
            open={open === 'contact-add' || open === 'contact-edit'}
            onClose={closeModal}
            instanceId={activeInstanceId}
            contactId={open === 'contact-edit' ? editId || undefined : undefined}
          />
          <EndpointModal
            open={open === 'endpoint-add' || open === 'endpoint-edit'}
            onClose={closeModal}
            instanceId={activeInstanceId}
            endpointId={open === 'endpoint-edit' ? editId || undefined : undefined}
          />
          <CertificateModal
            open={open === 'certificate-add'}
            onClose={closeModal}
            instanceId={activeInstanceId}
          />
          <MembershipModal
            open={open === 'membership-add' || open === 'membership-edit'}
            onClose={closeModal}
            instanceId={activeInstanceId}
            membershipId={open === 'membership-edit' ? editId || undefined : undefined}
          />
          <ApprovalModal
            open={open === 'approval'}
            onClose={closeModal}
            instanceId={activeInstanceId}
          />
          <DownloadModal
            open={open === 'download'}
            onClose={closeModal}
            instanceId={activeInstanceId}
          />
          <CertRenewalModal
            open={open === 'cert-renew'}
            onClose={closeModal}
            instanceId={activeInstanceId}
          />
        </>
      )}
    </div>
  );
}
