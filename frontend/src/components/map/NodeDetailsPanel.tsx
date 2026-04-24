/**
 * NodeDetailsPanel.tsx – Slide-in side panel showing one organization in full
 * Dependencies: react, network.api types
 */
import type { MapOrganization } from '../../api/network.api';

const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID:    '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED:  '#ef4444',
  NONE:     '#94a3b8',
};

const STATUS_LABEL: Record<MapOrganization['cert_status'], string> = {
  VALID: 'Valid',
  EXPIRING: 'Expiring soon',
  EXPIRED: 'Expired',
  NONE: 'No certificate',
};

interface Props {
  org: MapOrganization | null;
  onClose: () => void;
}

export function NodeDetailsPanel({ org, onClose }: Props) {
  const open = !!org;
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
              aria-label="Close details"
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '4px', borderRadius: '6px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '10px',
            background: STATUS_COLOR[org.cert_status] + '22',
            color: STATUS_COLOR[org.cert_status],
            fontSize: '12px', fontWeight: 600,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified_user</span>
            Certificate: {STATUS_LABEL[org.cert_status]}
            {org.next_cert_expiry && (
              <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.8 }}>
                {new Date(org.next_cert_expiry).toLocaleDateString()}
              </span>
            )}
          </div>

          <Section title="Location">
            <Row label="City" value={org.city ?? '—'} />
            <Row label="Country" value={org.country_code ?? '—'} />
            <Row label="Email" value={org.email} />
          </Section>

          <Section title={`Endpoints (${org.endpoints.length})`}>
            {org.endpoints.length === 0 && <Empty>No endpoints</Empty>}
            {org.endpoints.map(ep => (
              <div key={ep.identifier} style={{ padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{ep.name ?? ep.identifier}</div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280', wordBreak: 'break-all' }}>{ep.address}</div>
                {ep.ips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {ep.ips.map((ip, i) => (
                      <span key={i} style={{ fontSize: '10px', fontFamily: 'monospace', background: '#e6faf7', color: '#0d9488', padding: '1px 6px', borderRadius: '4px' }}>
                        {ip.ip}{ip.is_fhir ? ' · FHIR' : ''}{ip.is_bpe ? ' · BPE' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Section>

          <Section title={`Contacts (${org.contacts.length})`}>
            {org.contacts.length === 0 && <Empty>No contacts</Empty>}
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

          <Section title={`Memberships (${org.memberships.length})`}>
            {org.memberships.length === 0 && <Empty>No memberships</Empty>}
            {org.memberships.map((m, i) => (
              <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.parent_organization}</div>
                {m.roles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}>
                    {m.roles.map((role, j) => (
                      <span key={j} style={{ fontSize: '10px', fontWeight: 700, background: '#e8f0fb', color: '#4a90d9', padding: '1px 6px', borderRadius: '4px' }}>{role}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Section>
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
