import { useEndpoints }    from '../../hooks/useEndpoints';
import { useOrganization } from '../../hooks/useOrganization';
import { EntityCard }      from './EntityCard';
import { FkLink }          from './FkLink';
import { useModals }       from '../../hooks/useModals';

export function EndpointsCard({ instanceId }: { instanceId: string }) {
  const { data: endpoints = [], isLoading } = useEndpoints(instanceId);
  const { data: org } = useOrganization(instanceId);

  return (
    <EntityCard
      id="endpoints"
      title="Endpoints"
      borderColor="#3ecfb2"
      icon="hub"
      onAdd={() => useModals.getState().openModal('endpoint-add')}
    >
      {org && <FkLink label="Organization" targetEntity="organization" value={org.identifier} />}

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isLoading && <div style={{ color: '#9b9fad', fontSize: '12px' }}>Loading…</div>}
        {endpoints.map((ep: any) => (
          <div key={ep.identifier} style={{
            background: '#f8f9fc', border: '1px solid #e8eaf0',
            borderRadius: '10px', padding: '10px 12px',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#6c63ff44')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8eaf0')}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a2e', marginBottom: '2px' }}>
              {ep.name || ep.identifier}
            </div>
            <div className="mono-id" style={{ fontSize: '11px', color: '#9b9fad', marginBottom: '4px' }}>
              {ep.identifier}
            </div>
            <div style={{ fontSize: '11px', color: '#9b9fad', marginBottom: '6px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ep.address}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {(ep.ipAddresses || []).map((ip: any) => (
                <span key={ip.id} style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                  background: '#f0f2f8', color: '#9b9fad',
                  display: 'flex', alignItems: 'center', gap: '3px',
                }}>
                  {ip.ip}
                  {ip.isFhir && <span style={{ color: '#3ecfb2', fontWeight: 600 }}>F</span>}
                  {ip.isBpe  && <span style={{ color: '#4a90d9', fontWeight: 600 }}>B</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!isLoading && endpoints.length === 0 && (
          <div style={{ color: '#9b9fad', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
            No endpoints yet.
          </div>
        )}
      </div>
    </EntityCard>
  );
}
