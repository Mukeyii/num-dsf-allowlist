/**
 * NodeDetailsPanel.tsx – Slide-in side panel showing one organization
 * Admin view shows all sensitive fields. Non-admin view shows only
 * active/inactive status, certificate status (no exact date), and endpoint names.
 * Dependencies: react, network.api types, i18n.store
 */
import type { MapOrganization, MapClusterGroup } from '../../api/network.api';
import { useI18n } from '../../stores/i18n.store';

const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID:    '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED:  '#ef4444',
  NONE:     '#94a3b8',
};

const STATUS_LABEL_KEY: Record<MapOrganization['cert_status'], 'mapDetailsCertValid' | 'mapDetailsCertExpiring' | 'mapDetailsCertExpired' | 'mapDetailsCertNone'> = {
  VALID:    'mapDetailsCertValid',
  EXPIRING: 'mapDetailsCertExpiring',
  EXPIRED:  'mapDetailsCertExpired',
  NONE:     'mapDetailsCertNone',
};

interface Props {
  org: MapOrganization | null;
  cluster: MapClusterGroup | null;
  isAdmin: boolean;
  onClose: () => void;
  onSelectMember: (orgId: string) => void;
}

export function NodeDetailsPanel({ org, cluster, isAdmin, onClose, onSelectMember }: Props) {
  const { t } = useI18n();
  const open = !!org || !!cluster;
  return (
    <aside
      aria-hidden={!open}
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        width: '380px',
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        boxShadow: open ? '-8px 0 24px rgba(15,23,42,0.08)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        overflowY: 'auto',
        zIndex: 2,
      }}
    >
      {cluster && !org && (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {cluster.city ?? '—'}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {t('mapClusterCity', { n: cluster.members.length, city: cluster.city ?? '—' })}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label={t('mapCloseDetails')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {cluster.members.map(m => (
              <button
                key={m.identifier}
                onClick={() => onSelectMember(m.identifier)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: ({
                    VALID: '#22c55e', EXPIRING: '#f5a623',
                    EXPIRED: '#ef4444', NONE: '#94a3b8',
                  } as Record<MapOrganization['cert_status'], string>)[m.cert_status],
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.identifier}
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {org && (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {org.name}
              </h2>
              <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#b01e66', margin: '4px 0 0' }}>
                {org.identifier}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label={t('mapCloseDetails')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '999px', alignSelf: 'flex-start',
            background: org.active ? '#ecfdf5' : '#f1f5f9',
            color: org.active ? '#059669' : '#64748b',
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: org.active ? '#10b981' : '#94a3b8' }} />
            {t(org.active ? 'mapDetailsActive' : 'mapDetailsInactive')}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '10px',
            background: STATUS_COLOR[org.cert_status] + '22',
            color: STATUS_COLOR[org.cert_status],
            fontSize: '12px', fontWeight: 600,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified_user</span>
            {t('mapDetailsCertLabel')}: {t(STATUS_LABEL_KEY[org.cert_status])}
            {isAdmin && org.next_cert_expiry && (
              <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.85 }}>
                {new Date(org.next_cert_expiry).toLocaleDateString()}
              </span>
            )}
          </div>

          {(org.cert_status === 'EXPIRING' || org.cert_status === 'EXPIRED') && (
            <div style={{
              padding: '10px 12px', borderRadius: '10px',
              background: org.cert_status === 'EXPIRED' ? '#fef2f2' : '#fff7ed',
              border: `1px solid ${org.cert_status === 'EXPIRED' ? '#fecaca' : '#fed7aa'}`,
              display: 'flex', alignItems: 'flex-start', gap: '8px',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: '18px',
                color: org.cert_status === 'EXPIRED' ? '#b91c1c' : '#c2410c',
              }}>
                {org.cert_status === 'EXPIRED' ? 'error' : 'warning'}
              </span>
              <div style={{ fontSize: '12px', color: org.cert_status === 'EXPIRED' ? '#b91c1c' : '#9a3412' }}>
                {t(org.cert_status === 'EXPIRED' ? 'mapDetailsExpiredText' : 'mapDetailsExpiringText')}
                {isAdmin && typeof org.cert_days_until === 'number' && (
                  <div style={{ marginTop: '4px', fontWeight: 600 }}>
                    {org.cert_days_until < 0
                      ? (Math.abs(org.cert_days_until) === 1
                          ? t('mapDetailsExpiredAgoOne')
                          : t('mapDetailsExpiredAgoMany', { n: Math.abs(org.cert_days_until) }))
                      : (org.cert_days_until === 1
                          ? t('mapDetailsDayRemainingOne')
                          : t('mapDetailsDaysRemainingMany', { n: org.cert_days_until }))}
                  </div>
                )}
              </div>
            </div>
          )}

          <Section title={`${t('mapDetailsEndpoints')} (${org.endpoints.length})`}>
            {org.endpoints.length === 0 && <Empty>{t('mapDetailsNoEndpoints')}</Empty>}
            {org.endpoints.map(ep => {
              const adminEp = isAdmin && 'address' in ep ? ep : null;
              return (
                <div key={ep.identifier} style={{ padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{ep.name ?? ep.identifier}</div>
                  {adminEp && (
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280', wordBreak: 'break-all' }}>
                      {adminEp.address}
                    </div>
                  )}
                  {adminEp && adminEp.ips.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {adminEp.ips.map((ip, i) => (
                        <span key={i} style={{ fontSize: '10px', fontFamily: 'monospace', background: '#e6faf7', color: '#0d9488', padding: '1px 6px', borderRadius: '4px' }}>
                          {ip.ip}{ip.is_fhir ? ' · FHIR' : ''}{ip.is_bpe ? ' · BPE' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Section>

          {isAdmin && org.contacts && (
            <Section title={`${t('mapDetailsContacts')} (${org.contacts.length})`}>
              {org.contacts.length === 0 && <Empty>{t('mapDetailsNoContacts')}</Empty>}
              {org.contacts.map((c, i) => (
                <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name ?? '—'}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{c.email}</div>
                  {c.types.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#8b5cf6', marginTop: '2px' }}>{c.types.join(', ')}</div>
                  )}
                </div>
              ))}
            </Section>
          )}

          <Section title={`${t('mapDetailsMemberships')} (${org.memberships.length})`}>
            {org.memberships.length === 0 && <Empty>{t('mapDetailsNoMemberships')}</Empty>}
            {org.memberships.map((m, i) => {
              const adminM = isAdmin && 'endpoint_id' in m ? m : null;
              return (
                <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.parent_organization}</div>
                  {m.roles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}>
                      {m.roles.map((role, j) => (
                        <span key={j} style={{ fontSize: '10px', fontWeight: 700, background: '#e8f0fb', color: '#4a90d9', padding: '1px 6px', borderRadius: '4px' }}>{role}</span>
                      ))}
                    </div>
                  )}
                  {adminM && adminM.endpoint_id && (
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {adminM.endpoint_id}
                    </div>
                  )}
                </div>
              );
            })}
          </Section>

          {isAdmin && (org.city || org.country_code || org.email) && (
            <Section title={t('mapDetailsLocation')}>
              <Row label={t('mapDetailsCity')} value={org.city ?? '—'} />
              <Row label={t('mapDetailsCountry')} value={org.country_code ?? '—'} />
              <Row label={t('mapDetailsEmail')} value={org.email ?? '—'} />
            </Section>
          )}
        </div>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', marginBottom: '3px' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</div>;
}
