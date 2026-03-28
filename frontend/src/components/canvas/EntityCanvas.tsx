/**
 * EntityCanvas.tsx – 2×3 grid with all entity cards + SVG overlay
 */
import { useRef } from 'react';
import { RelationLines }    from './RelationLines';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = {
    organization:  useRef<HTMLDivElement>(null),
    contacts:      useRef<HTMLDivElement>(null),
    endpoints:     useRef<HTMLDivElement>(null),
    certificates:  useRef<HTMLDivElement>(null),
    memberships:   useRef<HTMLDivElement>(null),
    approval:      useRef<HTMLDivElement>(null),
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', padding: '20px', flex: 1, overflowY: 'auto' }}
    >
      <RelationLines cardRefs={refs} containerRef={containerRef} />
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
        <div ref={refs.organization}  id="card-organization">
          <OrganizationCard instanceId={instanceId} />
        </div>
        <div ref={refs.endpoints}     id="card-endpoints">
          <EndpointsCard instanceId={instanceId} />
        </div>
        <div ref={refs.memberships}   id="card-memberships">
          <MembershipsCard instanceId={instanceId} />
        </div>
        <div ref={refs.contacts}      id="card-contacts">
          <ContactsCard instanceId={instanceId} />
        </div>
        <div ref={refs.certificates}  id="card-certificates">
          <CertificatesCard instanceId={instanceId} />
        </div>
        <div ref={refs.approval}      id="card-approval">
          <ApprovalCard instanceId={instanceId} />
        </div>
      </div>
    </div>
  );
}
