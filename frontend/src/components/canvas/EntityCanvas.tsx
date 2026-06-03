/**
 * EntityCanvas.tsx – 3-column entity layout with responsive breakpoints
 * Columns: [Organization] | [Contacts, Endpoints] | [Memberships, Certificates]
 * Breakpoints: >1200px → 3 cols, 800-1200px → 2 cols, <800px → 1 col
 */
import { useState, useEffect } from 'react';
import { OnboardingWizard } from './OnboardingWizard';
import { OrganizationCard } from '../cards/OrganizationCard';
import { ContactsCard } from '../cards/ContactsCard';
import { EndpointsCard } from '../cards/EndpointsCard';
import { CertificatesCard } from '../cards/CertificatesCard';
import { MembershipsCard } from '../cards/MembershipsCard';

interface EntityCanvasProps {
  instanceId: string;
}

export function EntityCanvas({ instanceId }: EntityCanvasProps) {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    function updateCols() {
      const w = window.innerWidth - 500; // subtract sidebar (220) + right panel (280)
      if (w < 500) setCols(1);
      else if (w < 800) setCols(2);
      else setCols(3);
    }
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const gap = '16px';

  if (cols === 1) {
    return (
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <OnboardingWizard instanceId={instanceId} />
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          <div id="card-organization">
            <OrganizationCard instanceId={instanceId} />
          </div>
          <div id="card-contacts">
            <ContactsCard instanceId={instanceId} />
          </div>
          <div id="card-endpoints">
            <EndpointsCard instanceId={instanceId} />
          </div>
          <div id="card-memberships">
            <MembershipsCard instanceId={instanceId} />
          </div>
          <div id="card-certificates">
            <CertificatesCard instanceId={instanceId} />
          </div>
        </div>
      </div>
    );
  }

  if (cols === 2) {
    return (
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <OnboardingWizard instanceId={instanceId} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap }}>
            <div id="card-organization">
              <OrganizationCard instanceId={instanceId} />
            </div>
            <div id="card-contacts">
              <ContactsCard instanceId={instanceId} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap }}>
            <div id="card-endpoints">
              <EndpointsCard instanceId={instanceId} />
            </div>
            <div id="card-memberships">
              <MembershipsCard instanceId={instanceId} />
            </div>
            <div id="card-certificates">
              <CertificatesCard instanceId={instanceId} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3 columns (default, >1200px effective width)
  return (
    <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
      <OnboardingWizard instanceId={instanceId} />
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap, alignItems: 'start' }}
      >
        {/* Column 1: Organization */}
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          <div id="card-organization">
            <OrganizationCard instanceId={instanceId} />
          </div>
        </div>

        {/* Column 2: Contacts + Endpoints */}
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          <div id="card-contacts">
            <ContactsCard instanceId={instanceId} />
          </div>
          <div id="card-endpoints">
            <EndpointsCard instanceId={instanceId} />
          </div>
        </div>

        {/* Column 3: Memberships + Certificates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          <div id="card-memberships">
            <MembershipsCard instanceId={instanceId} />
          </div>
          <div id="card-certificates">
            <CertificatesCard instanceId={instanceId} />
          </div>
        </div>
      </div>
    </div>
  );
}
