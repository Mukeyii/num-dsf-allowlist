/**
 * StatusPage.tsx – Instance status overview for site admins
 * Dependencies: canvas.store, useOrganization, useContacts, useEndpoints,
 *               useCertificates, useMemberships, useApproval, dateUtils, i18n.store
 */
import { useCanvasStore } from '../stores/canvas.store';
import { useOrganization } from '../hooks/useOrganization';
import { useContacts } from '../hooks/useContacts';
import { useEndpoints } from '../hooks/useEndpoints';
import { useCertificates } from '../hooks/useCertificates';
import { useMemberships } from '../hooks/useMemberships';
import { useApprovalStatus, useApprovalHistory } from '../hooks/useApproval';
import { daysUntil } from '../lib/dateUtils';
import { useI18n } from '../stores/i18n.store';

function StatCard({
  icon,
  color,
  label,
  value,
  detail,
}: {
  icon: string;
  color: string;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        flex: 1,
        minWidth: '140px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color }}>
          {icon}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
        {value}
      </p>
      {detail && (
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{detail}</p>
      )}
    </div>
  );
}

export function StatusPage() {
  const { t } = useI18n();
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const { data: org } = useOrganization(activeInstanceId);
  const { data: contacts = [] } = useContacts(activeInstanceId);
  const { data: endpoints = [] } = useEndpoints(activeInstanceId);
  const { data: certs = [] } = useCertificates(activeInstanceId);
  const { data: memberships = [] } = useMemberships(activeInstanceId);
  const { data: approval } = useApprovalStatus(activeInstanceId);
  const { data: history = [] } = useApprovalHistory(activeInstanceId);

  const lastApproved = history.find((h: any) => h.status === 'APPROVED');
  const nextExpiry =
    certs.length > 0 ? Math.min(...certs.map((c: any) => daysUntil(c.valid_until))) : null;

  const statusColor =
    approval?.status === 'APPROVED'
      ? '#22c55e'
      : approval?.status === 'PENDING'
        ? '#f5a623'
        : approval?.status === 'REJECTED'
          ? '#ef4444'
          : 'var(--text-muted)';

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 4px',
          }}
        >
          {org?.name || t('instanceOverview')}
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          {org?.identifier || 'No organization configured'}
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard
          icon="contact_phone"
          color="#9b59b6"
          label={t('contacts')}
          value={contacts.length}
        />
        <StatCard icon="hub" color="#3ecfb2" label={t('endpoints')} value={endpoints.length} />
        <StatCard
          icon="verified_user"
          color="#f5a623"
          label={t('certificates')}
          value={certs.length}
          detail={nextExpiry !== null ? `${t('nextExpiry')}: ${nextExpiry}d` : undefined}
        />
        <StatCard
          icon="groups"
          color="#4a90d9"
          label={t('memberships')}
          value={memberships.length}
        />
      </div>

      {/* Approval Status */}
      <div
        style={{
          padding: '20px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h2
            style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('approvalStatus')}
          </h2>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '99px',
              background: `${statusColor}18`,
              color: statusColor,
            }}
          >
            {approval?.status || 'NO REQUEST'}
          </span>
        </div>
        {lastApproved && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            {t('lastApproved')}:{' '}
            {new Date(lastApproved.resolved_at || lastApproved.submitted_at).toLocaleDateString(
              'de-DE',
            )}
          </p>
        )}
      </div>

      {/* Certificate Expiry Warning */}
      {nextExpiry !== null && nextExpiry < 90 && (
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '16px',
            background: nextExpiry < 30 ? '#fef2f2' : '#fef9e7',
            border: `1px solid ${nextExpiry < 30 ? '#fecaca' : '#fde68a'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '20px', color: nextExpiry < 30 ? '#ef4444' : '#f5a623' }}
            >
              warning
            </span>
            <div>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: nextExpiry < 30 ? '#991b1b' : '#92400e',
                  margin: 0,
                }}
              >
                {t('certExpiresIn')} {nextExpiry} days
              </p>
              <p
                style={{
                  fontSize: '11px',
                  color: nextExpiry < 30 ? '#991b1b' : '#92400e',
                  margin: '2px 0 0',
                }}
              >
                {t('renewButtonHint')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Approval History */}
      <div
        style={{
          padding: '20px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 12px',
          }}
        >
          {t('approvalHistory')}
        </h2>
        {history.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('noApprovalRequests')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.slice(0, 10).map((req: any, i: number) => {
              const color =
                req.status === 'APPROVED'
                  ? '#22c55e'
                  : req.status === 'PENDING'
                    ? '#f5a623'
                    : '#ef4444';
              return (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-hover)',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      flex: 1,
                    }}
                  >
                    Request #{history.length - i}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(req.submitted_at || req.created_at).toLocaleDateString('de-DE')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color }}>{req.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
