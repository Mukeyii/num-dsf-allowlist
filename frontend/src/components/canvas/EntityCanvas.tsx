/**
 * EntityCanvas.tsx – 2×3 grid with all entity cards
 */
import { OnboardingWizard } from './OnboardingWizard';
import { OrganizationCard } from '../cards/OrganizationCard';
import { ContactsCard }     from '../cards/ContactsCard';
import { EndpointsCard }    from '../cards/EndpointsCard';
import { CertificatesCard } from '../cards/CertificatesCard';
import { MembershipsCard }  from '../cards/MembershipsCard';
import { ApprovalCard }     from '../cards/ApprovalCard';

interface EntityCanvasProps {
  instanceId: string;
}

export function EntityCanvas({ instanceId }: EntityCanvasProps) {
  return (
    <div
      style={{ position: 'relative', padding: '20px', flex: 1, overflowY: 'auto' }}
    >
      <OnboardingWizard instanceId={instanceId} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: 'auto auto',
          gap: '20px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div id="card-organization">
          <OrganizationCard instanceId={instanceId} />
        </div>
        <div id="card-endpoints">
          <EndpointsCard instanceId={instanceId} />
        </div>
        <div id="card-memberships">
          <MembershipsCard instanceId={instanceId} />
        </div>
        <div id="card-contacts">
          <ContactsCard instanceId={instanceId} />
        </div>
        <div id="card-certificates">
          <CertificatesCard instanceId={instanceId} />
        </div>
        <div id="card-approval">
          <ApprovalCard instanceId={instanceId} />
        </div>
      </div>
    </div>
  );
}
