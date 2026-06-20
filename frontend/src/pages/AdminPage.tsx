/**
 * AdminPage.tsx – Admin review page for pending approval requests.
 *
 * Thin page container. The per-request card with TOTP-gated approve/reject
 * and snapshot viewer lives in components/admin/RequestCard.tsx.
 *
 * Dependencies: useAdmin/useMe hooks, RequestCard component.
 */
import { Link, Navigate } from 'react-router-dom';
import { usePendingApprovals } from '../hooks/useAdmin';
import { useMe } from '../hooks/useMe';
import { useI18n } from '../stores/i18n.store';
import { RequestCard, type RequestCardProps } from '../components/admin/RequestCard';

export function AdminPage() {
  const { t } = useI18n();
  const { data: requests, isLoading, error } = usePendingApprovals();
  const { data: me } = useMe();

  const is403 = (error as { response?: { status?: number } } | null)?.response?.status === 403;

  if (me && !me.isAdmin) return <Navigate to="/app" replace />;

  return (
    <div
      style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '28px', color: 'var(--accent)' }}
        >
          admin_panel_settings
        </span>
        <div>
          <h1
            style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('adminPageTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {t('adminPageSubtitle')}
          </p>
        </div>
        <Link
          to="/app/admin/help"
          style={{
            marginLeft: 'auto',
            fontSize: '12px',
            color: 'var(--primary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            help
          </span>
          {t('adminHelpLink')}
        </Link>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 24px' }} />

      <div
        style={{
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '24px', color: '#c2410c', flexShrink: 0, marginTop: '2px' }}
        >
          shield
        </span>
        <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#7c2d12' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{t('adminFourEyesTitle')}</p>
          <p style={{ margin: 0 }}>{t('adminFourEyesBody')}</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '24px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '20px', color: '#ef4444' }}
          >
            error
          </span>
          <span style={{ fontSize: '13px', color: '#b91c1c' }}>
            {is403 ? t('adminAccessDenied') : t('adminLoadFailed')}
          </span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--text-muted)',
            fontSize: '14px',
            padding: '40px 0',
            justifyContent: 'center',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}
          >
            progress_activity
          </span>
          {t('adminLoadingRequests')}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && requests && requests.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
            gap: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '48px', color: '#22c55e' }}
          >
            check_circle
          </span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('adminNoPendingTitle')}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t('adminNoPendingBody')}
            </div>
          </div>
        </div>
      )}

      {/* Request cards */}
      {!isLoading && !error && requests && requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {requests.length === 1
              ? t('adminPendingCount', { n: requests.length })
              : t('adminPendingCountPlural', { n: requests.length })}
          </div>
          {requests.map((req: RequestCardProps['request']) => (
            <RequestCard key={req.id} request={req} meEmail={me?.email ?? null} />
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
