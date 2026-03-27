import { useMemberships }   from '../../hooks/useMemberships';
import { useOrganization }  from '../../hooks/useOrganization';
import { useEndpoints }     from '../../hooks/useEndpoints';
import { useCanvasStore }   from '../../stores/canvas.store';
import { EntityCard }       from './EntityCard';

export function MembershipsCard({ instanceId }: { instanceId: string }) {
  const { data: memberships = [], isLoading } = useMemberships(instanceId);
  const { data: org }       = useOrganization(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const highlightEntity     = useCanvasStore((s) => s.highlightEntity);

  return (
    <EntityCard
      id="memberships"
      title="Memberships"
      borderColor="#4a90d9"
      icon="groups"
      onAdd={() => {/* Phase 6 */}}
    >
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {org && (
          <span
            style={{ fontSize: '9px', color: '#94a3b8', cursor: 'pointer' }}
            onClick={() => { highlightEntity('organization'); document.getElementById('card-organization')?.scrollIntoView({ behavior: 'smooth' }); }}
          >
            FK: {org.identifier}
          </span>
        )}
        {endpoints[0] && (
          <span
            style={{ fontSize: '9px', color: '#94a3b8', cursor: 'pointer' }}
            onClick={() => { highlightEntity('endpoints'); document.getElementById('card-endpoints')?.scrollIntoView({ behavior: 'smooth' }); }}
          >
            FK: {endpoints[0].identifier}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isLoading && <p style={{ color: '#9b9fad', fontSize: '12px' }}>Loading…</p>}
        {memberships.map((ms: any) => {
          const roles = JSON.parse(ms.roles || '[]');
          return (
            <div
              key={ms.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px', borderRadius: '8px',
                background: 'rgba(74,144,217,0.05)', border: '1px solid rgba(74,144,217,0.1)',
                transition: 'border-color 0.15s',
              }}
            >
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700 }}>{ms.parent_organization}</p>
                {roles.map((r: string) => (
                  <span key={r} style={{ fontSize: '9px', fontWeight: 700, color: '#2563eb', marginRight: '4px' }}>{r} </span>
                ))}
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>
                check_circle
              </span>
            </div>
          );
        })}
        {!isLoading && memberships.length === 0 && (
          <p style={{ color: '#9b9fad', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>No memberships yet.</p>
        )}
      </div>
    </EntityCard>
  );
}
