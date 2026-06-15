/**
 * AuditPage.tsx – Cross-instance audit log view
 * Shows events across ALL instances the user has access to (admin = all).
 * Dependencies: useCrossInstanceAudit, useI18n
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCrossInstanceAudit } from '../hooks/useAudit';
import { useMe } from '../hooks/useMe';
import { useI18n } from '../stores/i18n.store';

const STATUS_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  APPROVE: 'bg-teal-100 text-teal-700',
  REJECT: 'bg-orange-100 text-orange-700',
  LOGIN: 'bg-indigo-100 text-indigo-700',
  LOGOUT: 'bg-slate-100 text-slate-600',
  DEFAULT: 'bg-slate-100 text-slate-500',
};

export function AuditPage() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const [page, setPage] = useState(1);
  const limit = 50;
  const { data, isLoading, error } = useCrossInstanceAudit(page, limit);
  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const isAdmin = !!data?.meta.isAdmin;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  // When the dataset shrinks the current page can fall past the last page,
  // querying an empty page; clamp back into [1, totalPages].
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#b01e66' }}>
          history
        </span>
        <div>
          <h1
            style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('auditLog')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {isAdmin ? t('auditScopeAdmin') : t('auditScopeOwner')}
          </p>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 24px' }} />

      {isLoading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('loading')}</p>}
      {error && <p style={{ color: '#ef4444', fontSize: '14px' }}>{t('auditLoadFailed')}</p>}

      {!isLoading && !error && rows.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('auditEmpty')}</p>
      )}

      {rows.length > 0 && (
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--bg-card)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {t('auditColTimestamp')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {t('auditColInstance')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {t('auditColUser')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {t('auditColResource')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {t('auditColOperation')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {t('auditColIp')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td
                    style={{
                      padding: '10px 12px',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                    {r.organization_name ??
                      r.instance_label ??
                      (r.instance_id ? r.instance_id.slice(0, 8) : '—')}
                    {r.organization_identifier && (
                      <div
                        style={{
                          fontFamily: 'monospace',
                          color: 'var(--text-muted)',
                          fontSize: '10px',
                        }}
                      >
                        {r.organization_identifier}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {r.user_email ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                    {r.resource_type}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_COLORS[r.operation] ?? STATUS_COLORS.DEFAULT}`}
                    >
                      {r.operation}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      color: 'var(--text-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {r.ip_address ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '16px',
            justifyContent: 'flex-end',
            fontSize: '12px',
          }}
        >
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:border-primary text-slate-600 transition-colors"
          >
            {t('prev')}
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('paginationShowing', { page, total: totalPages })}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:border-primary text-slate-600 transition-colors"
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  );
}
