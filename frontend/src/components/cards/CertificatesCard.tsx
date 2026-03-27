import { useCertificates }  from '../../hooks/useCertificates';
import { useOrganization }  from '../../hooks/useOrganization';
import { EntityCard }       from './EntityCard';
import { useModals }        from '../../hooks/useModals';

function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function CertificatesCard({ instanceId }: { instanceId: string }) {
  const { data: certs = [], isLoading } = useCertificates(instanceId);
  const { data: org } = useOrganization(instanceId);

  return (
    <EntityCard
      id="certificates"
      title="Certificates"
      borderColor="#f5a623"
      icon="verified_user"
      headerRight={
        <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '20px' }}>lock</span>
      }
      onAdd={() => useModals.getState().openModal('certificate-add')}
    >
      {org && <p className="text-[10px] text-slate-400 mb-4">FK: Organization {org.identifier}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading && <p style={{ color: '#9b9fad', fontSize: '12px' }}>Loading…</p>}
        {certs.map((cert: any) => {
          const days = daysUntil(cert.valid_until);
          const pct  = Math.max(0, Math.min(100, (days / 365) * 100));
          const barColor = days < 30 ? '#e05c5c' : days < 90 ? '#f5a623' : '#22c55e';
          return (
            <div key={cert.id} style={{
              padding: '12px', background: 'rgba(245,166,35,0.05)',
              borderRadius: '12px', border: '1px solid rgba(245,166,35,0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="mono-id" style={{ fontSize: '11px', color: '#4d41df' }}>{cert.subject}</span>
                <span style={{
                  padding: '1px 8px', borderRadius: '99px', fontSize: '9px', fontWeight: 700,
                  background: '#dcfce7', color: '#15803d',
                }}>ACTIVE</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: '99px', background: barColor }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>{days}d left</span>
              </div>
            </div>
          );
        })}
        {!isLoading && certs.length === 0 && (
          <p style={{ color: '#9b9fad', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>No certificates yet.</p>
        )}
      </div>
    </EntityCard>
  );
}
