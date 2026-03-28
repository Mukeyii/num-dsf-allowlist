import { useMemberships, useDeleteMembership } from '../../hooks/useMemberships';
import { useOrganization }  from '../../hooks/useOrganization';
import { useEndpoints }     from '../../hooks/useEndpoints';
import { EntityCard }       from './EntityCard';
import { FkLink }           from './FkLink';
import { parseJsonArray }  from '../../lib/parseJsonArray';
import { useModals }        from '../../hooks/useModals';
import { toast } from 'sonner';

export function MembershipsCard({ instanceId }: { instanceId: string }) {
  const { data: memberships = [], isLoading } = useMemberships(instanceId);
  const { data: org }       = useOrganization(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const deleteMut = useDeleteMembership(instanceId);

  return (
    <EntityCard
      id="memberships"
      title="Memberships"
      borderColor="#4a90d9"
      icon="groups"
      onAdd={() => useModals.getState().openModal('membership-add')}
    >
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {org && <FkLink label="Organization" targetEntity="organization" value={org.identifier} />}
        {endpoints[0] && <FkLink label="Endpoint" targetEntity="endpoints" value={endpoints[0].identifier} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isLoading && <p style={{ color: '#9b9fad', fontSize: '12px' }}>Loading…</p>}
        {memberships.map((ms: any) => {
          const roles = parseJsonArray(ms.roles);
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); useModals.getState().openModal('membership-edit', ms.id); }}
                  title="Edit membership"
                  style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#ede9ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6c63ff' }}>edit</span>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm('Delete this membership?')) {
                      try { await deleteMut.mutateAsync(ms.id); toast.success('Membership deleted.'); }
                      catch { toast.error('Failed to delete membership.'); }
                    }
                  }}
                  title="Delete membership"
                  style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>delete</span>
                </button>
              </div>
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
