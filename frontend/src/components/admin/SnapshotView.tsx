/**
 * SnapshotView.tsx — Read-only viewer for an approval-request data snapshot.
 * Renders the quick change-count summary and the per-entity detail grid.
 * Extracted from RequestCard.tsx (project 500-line file limit); pure
 * presentation driven by a parsed SnapshotData.
 *
 * Dependencies: parseSnapshot (SnapshotData type), useI18n (translate fn type).
 */
import type { SnapshotData } from './parseSnapshot';
import type { TranslationKey } from '../../i18n/en';

type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function SnapshotView({ snapshot, t }: { snapshot: SnapshotData; t: TranslateFn }) {
  const endpoints = snapshot.endpoints ?? [];
  const certificates = snapshot.certificates ?? [];
  const memberships = snapshot.memberships ?? [];
  const contacts = snapshot.contacts ?? [];

  return (
    <>
      {/* Quick change summary */}
      {snapshot.organization && (
        <div style={{ marginTop: '8px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#ede9ff',
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            >
              {t('requestCardCountEndpoints', { n: (snapshot.endpoints || []).length })}
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#fef9e7',
                color: '#b45309',
                fontWeight: 600,
              }}
            >
              {t('requestCardCountCertificates', { n: (snapshot.certificates || []).length })}
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#e8f4fd',
                color: '#1d4ed8',
                fontWeight: 600,
              }}
            >
              {t('requestCardCountMemberships', { n: (snapshot.memberships || []).length })}
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#f0fff8',
                color: '#059669',
                fontWeight: 600,
              }}
            >
              {t('requestCardCountContacts', { n: (snapshot.contacts || []).length })}
            </span>
          </div>
        </div>
      )}

      {/* Snapshot viewer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}
      >
        {/* Organization */}
        <SnapshotSection title={t('organization')} color="#6c63ff" icon="corporate_fare">
          {snapshot.organization ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <SnapshotField label={t('orgCardName')} value={snapshot.organization.name} />
              <SnapshotField
                label={t('requestCardFieldId')}
                value={snapshot.organization.identifier}
                mono
              />
              {snapshot.organization.email && (
                <SnapshotField
                  label={t('orgCardEmail')}
                  value={String(snapshot.organization.email)}
                />
              )}
              {snapshot.organization.city && (
                <SnapshotField
                  label={t('orgCardCity')}
                  value={String(snapshot.organization.city)}
                />
              )}
              {snapshot.organization.country_code && (
                <SnapshotField
                  label={t('mapDetailsCountry')}
                  value={String(snapshot.organization.country_code)}
                />
              )}
            </div>
          ) : (
            <EmptyNote>{t('adminSnapshotNoOrg')}</EmptyNote>
          )}
        </SnapshotSection>

        {/* Endpoints */}
        <SnapshotSection
          title={t('requestCardSectionEndpoints', { n: endpoints.length })}
          color="#3ecfb2"
          icon="dns"
        >
          {endpoints.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {endpoints.map((ep, i) => (
                <div key={i} style={{ borderLeft: '3px solid #3ecfb2', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ep.name ?? ep.identifier ?? '—'}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}
                  >
                    {ep.address}
                  </div>
                  {ep.ips && ep.ips.length > 0 && (
                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}
                    >
                      {ep.ips.map((ip, j) => (
                        <span
                          key={j}
                          style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            background: '#e6faf7',
                            color: '#0d9488',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {ip.ip}
                          {ip.is_fhir ? ' [FHIR]' : ''}
                          {ip.is_bpe ? ' [BPE]' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote>{t('adminSnapshotNoEndpoints')}</EmptyNote>
          )}
        </SnapshotSection>

        {/* Certificates */}
        <SnapshotSection
          title={t('requestCardSectionCertificates', { n: certificates.length })}
          color="#f5a623"
          icon="verified_user"
        >
          {certificates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {certificates.map((cert, i) => (
                <div key={i} style={{ borderLeft: '3px solid #f5a623', paddingLeft: '8px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {cert.subject ?? '—'}
                  </div>
                  {cert.thumbprint && (
                    <div
                      style={{
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {cert.thumbprint}
                    </div>
                  )}
                  {cert.valid_until && (
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {t('adminSnapshotExpires', { date: cert.valid_until })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote>{t('adminSnapshotNoCerts')}</EmptyNote>
          )}
        </SnapshotSection>

        {/* Memberships */}
        <SnapshotSection
          title={t('requestCardSectionMemberships', { n: memberships.length })}
          color="#4a90d9"
          icon="group_work"
        >
          {memberships.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {memberships.map((m, i) => (
                <div key={i} style={{ borderLeft: '3px solid #4a90d9', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.parent_organization ?? '—'}
                  </div>
                  {m.roles && m.roles.length > 0 && (
                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}
                    >
                      {m.roles.map((role, j) => (
                        <span
                          key={j}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            background: '#e8f0fb',
                            color: '#4a90d9',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.endpoint_id && (
                    <div
                      style={{
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {m.endpoint_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote>{t('adminSnapshotNoMemberships')}</EmptyNote>
          )}
        </SnapshotSection>

        {/* Contacts — spans full width if present */}
        {contacts.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <SnapshotSection
              title={t('requestCardSectionContacts', { n: contacts.length })}
              color="#8b5cf6"
              icon="contacts"
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {contacts.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      minWidth: '160px',
                    }}
                  >
                    <div
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      {c.name ?? '—'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{c.email}</div>
                    {c.types && c.types.length > 0 && (
                      <div style={{ fontSize: '10px', color: '#8b5cf6', marginTop: '2px' }}>
                        {c.types.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SnapshotSection>
          </div>
        )}
      </div>
    </>
  );
}

function SnapshotSection({
  title,
  color,
  icon,
  children,
}: {
  title: string;
  color: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color }}>
          {icon}
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color,
            fontFamily: 'Inter, system-ui, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function SnapshotField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          minWidth: '50px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '12px',
          color: 'var(--text-primary)',
          fontFamily: mono ? 'monospace' : 'Inter, system-ui, sans-serif',
          wordBreak: 'break-all',
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {children}
    </span>
  );
}
