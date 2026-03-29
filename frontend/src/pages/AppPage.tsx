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
  useInstances();

  const { open, editId, openModal, closeModal } = useModals();
  const { data: org } = useOrganization(activeInstanceId);

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'var(--bg-page)',
    }}>
      <Sidebar />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginLeft: '220px', marginRight: '280px',
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

      <RightPanel instanceId={activeInstanceId} />
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
