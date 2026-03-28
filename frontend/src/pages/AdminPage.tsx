/**
 * AdminPage.tsx – Admin review page for pending approval requests
 * Dependencies: useAdmin hooks, sonner toast, Material Symbols icons
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { usePendingApprovals, useApproveRequest, useRejectRequest } from '../hooks/useAdmin';

function relTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface SnapshotData {
  organization?: { name?: string; identifier?: string; email?: string; city?: string; country_code?: string; active?: boolean; address_line?: string; postal_code?: string };
  endpoints?: Array<{ identifier?: string; address?: string; name?: string; ips?: Array<{ ip: string; is_fhir?: boolean; is_bpe?: boolean }> }>;
  certificates?: Array<{ subject?: string; thumbprint?: string; valid_until?: string }>;
  memberships?: Array<{ parent_organization?: string; roles?: string[]; endpoint_id?: string }>;
  contacts?: Array<{ name?: string; email?: string; types?: string[] }>;
}

function parseSnapshot(raw: string | object | null | undefined): SnapshotData {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as SnapshotData;
  try {
    return JSON.parse(raw as string) as SnapshotData;
  } catch {
    return {};
  }
}

interface RequestCardProps {
  request: {
    id: string;
    status: string;
    created_at?: string;
    submitted_at?: string;
    snapshot_json: string | object | null;
  };
}

function RequestCard({ request }: RequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const approveMut = useApproveRequest();
  const rejectMut = useRejectRequest();

  const snapshot = parseSnapshot(request.snapshot_json);
  const orgName = snapshot.organization?.name ?? '—';
  const orgId = snapshot.organization?.identifier ?? '—';
  const timeStr = request.submitted_at ?? request.created_at ?? '';

  async function handleApprove() {
    if (!totpCode || totpCode.length !== 6) {
      toast.error('Please enter your 6-digit authenticator code.');
      return;
    }
    try {
      await approveMut.mutateAsync({ requestId: request.id, totpCode });
      toast.success('Request approved.');
      setTotpCode('');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to approve request.';
      toast.error(msg);
    }
  }

  async function handleReject() {
    if (!comment.trim()) {
      toast.error('Please provide a reason for rejection.');
      return;
    }
    if (!totpCode || totpCode.length !== 6) {
      toast.error('Please enter your 6-digit authenticator code.');
      return;
    }
    try {
      await rejectMut.mutateAsync({ requestId: request.id, comment: comment.trim(), totpCode });
      toast.success('Request rejected.');
      setRejecting(false);
      setComment('');
      setTotpCode('');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to reject request.';
      toast.error(msg);
    }
  }

  const endpoints = snapshot.endpoints ?? [];
  const certificates = snapshot.certificates ?? [];
  const memberships = snapshot.memberships ?? [];
  const contacts = snapshot.contacts ?? [];

  return (
    <div style={{
      background: '#f8f9fc',
      border: '1px solid #e8eaf0',
      borderRadius: '16px',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 600,
              color: '#1a1a2e',
            }}>{orgName}</span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#6c63ff',
              background: '#ede9ff',
              padding: '2px 8px',
              borderRadius: '6px',
            }}>{orgId}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#b45309',
              background: '#fef3c7',
              padding: '2px 8px',
              borderRadius: '20px',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}>Pending</span>
            {timeStr && (
              <span style={{ fontSize: '12px', color: '#9b9fad' }}>{relTime(timeStr)}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleApprove}
            disabled={approveMut.isPending || rejectMut.isPending}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: approveMut.isPending ? '#86efac' : '#22c55e',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: approveMut.isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'opacity 0.15s',
            }}
          >
            {approveMut.isPending ? 'Approving…' : 'Approve'}
          </button>
          {!rejecting ? (
            <button
              onClick={() => setRejecting(true)}
              disabled={approveMut.isPending || rejectMut.isPending}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1.5px solid #ef4444',
                background: 'transparent',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: 600,
                cursor: approveMut.isPending || rejectMut.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background 0.15s',
              }}
            >
              Reject
            </button>
          ) : null}
        </div>
      </div>

      {/* Reject comment panel */}
      {rejecting && (
        <div style={{
          background: '#fff5f5',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c', fontFamily: 'Inter, system-ui, sans-serif' }}>
            Rejection reason (required)
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Explain why this request is being rejected…"
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
              color: '#1a1a2e',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleReject}
              disabled={rejectMut.isPending}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: 'none',
                background: rejectMut.isPending ? '#fca5a5' : '#ef4444',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: rejectMut.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {rejectMut.isPending ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => { setRejecting(false); setComment(''); }}
              disabled={rejectMut.isPending}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: '1px solid #e8eaf0',
                background: '#fff',
                color: '#6b7280',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* TOTP confirmation input */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#6c63ff' }}>lock</span>
        <input
          type="text"
          value={totpCode}
          onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit authenticator code"
          maxLength={6}
          style={{
            width: '180px', padding: '8px 12px', borderRadius: '10px',
            border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'monospace',
            letterSpacing: '4px', textAlign: 'center', outline: 'none',
          }}
        />
        <span style={{ fontSize: '10px', color: '#9b9fad' }}>Required for approve/reject</span>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          border: '1px solid #e8eaf0',
          borderRadius: '8px',
          background: '#fff',
          color: '#6b7280',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
        {expanded ? 'Hide details' : 'View submitted data'}
      </button>

      {/* Snapshot viewer */}
      {expanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}>
          {/* Organization */}
          <SnapshotSection title="Organization" color="#6c63ff" icon="corporate_fare">
            {snapshot.organization ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <SnapshotField label="Name" value={snapshot.organization.name} />
                <SnapshotField label="ID" value={snapshot.organization.identifier} mono />
                {snapshot.organization.email && <SnapshotField label="Email" value={String(snapshot.organization.email)} />}
                {snapshot.organization.city && <SnapshotField label="City" value={String(snapshot.organization.city)} />}
                {snapshot.organization.country_code && <SnapshotField label="Country" value={String(snapshot.organization.country_code)} />}
              </div>
            ) : (
              <EmptyNote>No organization data</EmptyNote>
            )}
          </SnapshotSection>

          {/* Endpoints */}
          <SnapshotSection title={`Endpoints (${endpoints.length})`} color="#3ecfb2" icon="dns">
            {endpoints.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {endpoints.map((ep, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #3ecfb2', paddingLeft: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a2e' }}>{ep.name ?? ep.identifier ?? '—'}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace', wordBreak: 'break-all' }}>{ep.address}</div>
                    {ep.ips && ep.ips.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {ep.ips.map((ip, j) => (
                          <span key={j} style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            background: '#e6faf7',
                            color: '#0d9488',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}>
                            {ip.ip}{ip.is_fhir ? ' [FHIR]' : ''}{ip.is_bpe ? ' [BPE]' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote>No endpoints</EmptyNote>
            )}
          </SnapshotSection>

          {/* Certificates */}
          <SnapshotSection title={`Certificates (${certificates.length})`} color="#f5a623" icon="verified_user">
            {certificates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {certificates.map((cert, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #f5a623', paddingLeft: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a2e', wordBreak: 'break-all' }}>{cert.subject ?? '—'}</div>
                    {cert.thumbprint && (
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#9b9fad', wordBreak: 'break-all' }}>{cert.thumbprint}</div>
                    )}
                    {cert.valid_until && (
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>Expires: {cert.valid_until}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote>No certificates</EmptyNote>
            )}
          </SnapshotSection>

          {/* Memberships */}
          <SnapshotSection title={`Memberships (${memberships.length})`} color="#4a90d9" icon="group_work">
            {memberships.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {memberships.map((m, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #4a90d9', paddingLeft: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a2e' }}>{m.parent_organization ?? '—'}</div>
                    {m.roles && m.roles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}>
                        {m.roles.map((role, j) => (
                          <span key={j} style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            background: '#e8f0fb',
                            color: '#4a90d9',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}>{role}</span>
                        ))}
                      </div>
                    )}
                    {m.endpoint_id && (
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#9b9fad', marginTop: '2px' }}>{m.endpoint_id}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote>No memberships</EmptyNote>
            )}
          </SnapshotSection>

          {/* Contacts — spans full width if present */}
          {contacts.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <SnapshotSection title={`Contacts (${contacts.length})`} color="#8b5cf6" icon="contacts">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {contacts.map((c, i) => (
                    <div key={i} style={{
                      background: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      minWidth: '160px',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a2e' }}>{c.name ?? '—'}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{c.email}</div>
                      {c.types && c.types.length > 0 && (
                        <div style={{ fontSize: '10px', color: '#8b5cf6', marginTop: '2px' }}>{c.types.join(', ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </SnapshotSection>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SnapshotSection({
  title, color, icon, children,
}: {
  title: string;
  color: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8eaf0',
      borderRadius: '12px',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function SnapshotField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
      <span style={{ fontSize: '11px', color: '#9b9fad', minWidth: '50px', fontFamily: 'Inter, system-ui, sans-serif' }}>{label}</span>
      <span style={{
        fontSize: '12px',
        color: '#1a1a2e',
        fontFamily: mono ? 'monospace' : 'Inter, system-ui, sans-serif',
        wordBreak: 'break-all',
      }}>{value ?? '—'}</span>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: '12px', color: '#9b9fad', fontStyle: 'italic', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {children}
    </span>
  );
}

export function AdminPage() {
  const { data: requests, isLoading, error } = usePendingApprovals();

  const is403 = (error as { response?: { status?: number } } | null)?.response?.status === 403;

  return (
    <div style={{
      flex: 1,
      padding: '32px',
      overflowY: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#6c63ff' }}>
          admin_panel_settings
        </span>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            Approval Review
          </h1>
          <p style={{ fontSize: '13px', color: '#9b9fad', margin: '2px 0 0' }}>
            Review and action pending approval requests from DSF participants
          </p>
        </div>
      </div>

      <div style={{ height: '1px', background: '#e8eaf0', margin: '20px 0 24px' }} />

      {/* Error state */}
      {error && (
        <div style={{
          background: '#fff5f5',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ef4444' }}>error</span>
          <span style={{ fontSize: '13px', color: '#b91c1c' }}>
            {is403
              ? 'Access denied. You do not have admin privileges.'
              : 'Failed to load pending requests. Please try again later.'}
          </span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#9b9fad',
          fontSize: '14px',
          padding: '40px 0',
          justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>
            progress_activity
          </span>
          Loading pending requests…
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && requests && requests.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 0',
          gap: '12px',
          color: '#9b9fad',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#22c55e' }}>
            check_circle
          </span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a2e' }}>No pending requests</div>
            <div style={{ fontSize: '13px', color: '#9b9fad', marginTop: '4px' }}>
              All approval requests have been processed.
            </div>
          </div>
        </div>
      )}

      {/* Request cards */}
      {!isLoading && !error && requests && requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: '#9b9fad', marginBottom: '4px' }}>
            {requests.length} pending request{requests.length !== 1 ? 's' : ''}
          </div>
          {requests.map((req: RequestCardProps['request']) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
