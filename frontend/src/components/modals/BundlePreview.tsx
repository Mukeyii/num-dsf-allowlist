/**
 * BundlePreview.tsx – Readable FHIR Bundle preview
 * Dependencies: useOrganization, useEndpoints, useCertificates, useMemberships
 */
import { useState } from 'react';
import { useOrganization } from '../../hooks/useOrganization';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useCertificates } from '../../hooks/useCertificates';
import { useMemberships } from '../../hooks/useMemberships';

interface Props {
  instanceId: string;
}

export function BundlePreview({ instanceId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: org } = useOrganization(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const { data: certs = [] } = useCertificates(instanceId);
  const { data: memberships = [] } = useMemberships(instanceId);

  if (!org) return null;

  const resourceCount = 1 + endpoints.length + certs.length + memberships.length;

  return (
    <div style={{ marginTop: '16px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          border: '1px solid var(--border)', borderRadius: '8px',
          padding: '8px 12px', background: 'var(--bg-card)', cursor: 'pointer',
          fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', width: '100%',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          {expanded ? 'expand_less' : 'preview'}
        </span>
        {expanded ? 'Hide' : 'Preview'} Bundle ({resourceCount} resources)
      </button>

      {expanded && (
        <div style={{ marginTop: '8px', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          {/* Organization */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#6c63ff' }}>corporate_fare</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6c63ff', textTransform: 'uppercase' }}>Organization</span>
            </div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{org.name}</p>
            <p style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', margin: '2px 0 0' }}>{org.identifier}</p>
          </div>

          {/* Endpoints */}
          {endpoints.map((ep: any) => (
            <div key={ep.identifier} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#3ecfb2' }}>hub</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#3ecfb2', textTransform: 'uppercase' }}>Endpoint</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{ep.name || ep.identifier}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{ep.address}</p>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {(ep.ipAddresses || []).map((ip: any, i: number) => (
                  <span key={i} style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '99px', background: 'var(--bg-page)', color: 'var(--text-muted)' }}>
                    {ip.ip}{ip.isFhir ? ' F' : ''}{ip.isBpe ? ' B' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Certificates */}
          {certs.map((cert: any) => (
            <div key={cert.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#f5a623' }}>verified_user</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f5a623', textTransform: 'uppercase' }}>Certificate</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-primary)', margin: 0 }}>{cert.subject}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Valid until: {cert.valid_until}</p>
            </div>
          ))}

          {/* Memberships (OrganizationAffiliation) */}
          {memberships.map((ms: any) => {
            const roles = Array.isArray(ms.roles) ? ms.roles : JSON.parse(ms.roles || '[]');
            return (
              <div key={ms.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#4a90d9' }}>groups</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a90d9', textTransform: 'uppercase' }}>Affiliation</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-primary)', margin: 0 }}>{ms.parent_organization}</p>
                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                  {roles.map((r: string) => (
                    <span key={r} style={{ fontSize: '9px', fontWeight: 700, color: '#4a90d9' }}>{r}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
