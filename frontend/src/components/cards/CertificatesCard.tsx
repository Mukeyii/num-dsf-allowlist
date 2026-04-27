import { useCertificates, useDeleteCertificate } from '../../hooks/useCertificates';
import { useOrganization }  from '../../hooks/useOrganization';
import { EntityCard }       from './EntityCard';
import { FkLink }           from './FkLink';
import { useModals }        from '../../hooks/useModals';
import { daysUntil }        from '../../lib/dateUtils';
import { useI18n } from '../../stores/i18n.store';
import { undoableDelete } from '../../lib/undoDelete';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';

export function CertificatesCard({ instanceId }: { instanceId: string }) {
  const { t } = useI18n();
  const { data: certs = [], isLoading } = useCertificates(instanceId);
  const { data: org } = useOrganization(instanceId);
  const deleteMut = useDeleteCertificate(instanceId);
  const guard = useCrossUserGuard();

  return (
    <EntityCard
      id="certificates"
      title={t('certificates')}
      borderColor="#f5a623"
      icon="verified_user"
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => useModals.getState().openModal('cert-renew')}
            style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', border: '1px solid #f5a623', background: 'transparent', color: '#f5a623', cursor: 'pointer' }}
          >
            Renew
          </button>
          <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '20px' }}>lock</span>
        </div>
      }
      onAdd={() => useModals.getState().openModal('certificate-add')}
    >
      {org && <FkLink label="Organization" targetEntity="organization" value={org.identifier} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t('loading')}</p>}
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
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>{days}d left</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => {
                    undoableDelete(cert.subject || 'Certificate', () => new Promise<void>((resolve, reject) => {
                      guard(async () => {
                        try { await deleteMut.mutateAsync(cert.id); resolve(); } catch (e) { reject(e); }
                      });
                    }));
                  }}
                  title="Delete certificate"
                  aria-label="Delete certificate"
                  style={{ fontSize: '10px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontWeight: 600, transition: 'background 0.15s', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>delete</span>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        {!isLoading && certs.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>{t('noData')}</p>
        )}
      </div>
    </EntityCard>
  );
}
