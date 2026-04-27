import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCanvasStore } from '../stores/canvas.store';
import { api } from '../api/entities.api';
import { useI18n } from '../stores/i18n.store';

const RESOURCE_TYPES = ['ALL', 'ORGANIZATION', 'CONTACT', 'ENDPOINT', 'CERTIFICATE', 'MEMBERSHIP', 'AUTH', 'APPROVAL'];
const OPERATIONS = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'OTP_REQUEST'];

const STATUS_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700', UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700', APPROVE: 'bg-teal-100 text-teal-700',
  REJECT: 'bg-orange-100 text-orange-700', LOGIN: 'bg-indigo-100 text-indigo-700',
  LOGOUT: 'bg-slate-100 text-slate-600', DEFAULT: 'bg-slate-100 text-slate-500',
};

function relTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function AuditPage() {
  const { t } = useI18n();
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const [resource, setResource] = useState('ALL');
  const [operation, setOperation] = useState('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', activeInstanceId, resource, operation, page],
    queryFn: async () => {
      if (!activeInstanceId) return { data: [], meta: { total: 0, pages: 1 } };
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (resource !== 'ALL') params.set('resource', resource);
      if (operation !== 'ALL') params.set('operation', operation);
      const res = await api(activeInstanceId).getAuditLog(params.toString());
      return res.data;
    },
    enabled: !!activeInstanceId,
  });

  const logs = data?.data || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('auditLog')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('auditPageSubtitle', { n: meta.total })}</p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
          {t('auditExportPdf')}
        </button>
      </div>
      <div className="flex gap-3 mb-6 flex-wrap">
        <select value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}
          className="text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-primary transition-colors">
          {RESOURCE_TYPES.map(r => (<option key={r} value={r}>{r === 'ALL' ? t('auditAllResources') : r}</option>))}
        </select>
        <select value={operation} onChange={e => { setOperation(e.target.value); setPage(1); }}
          className="text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-primary transition-colors">
          {OPERATIONS.map(o => (<option key={o} value={o}>{o === 'ALL' ? t('auditAllOperations') : o}</option>))}
        </select>
      </div>
      <div className="bg-white rounded-2xl entity-card-shadow overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {[t('auditColTimestamp'), t('auditColOperation'), t('auditColResource'), t('auditColResourceId'), t('auditColUser'), t('auditColIp')].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && (<tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('loading')}</td></tr>)}
            {!isLoading && logs.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('auditNoEntries')}</td></tr>)}
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap"><span title={new Date(log.timestamp).toLocaleString()}>{relTime(log.timestamp)}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_COLORS[log.operation] || STATUS_COLORS.DEFAULT}`}>{log.operation}</span></td>
                <td className="px-4 py-3 text-slate-600 font-medium">{log.resource_type}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-primary max-w-[160px] truncate" title={log.resource_id}>{log.resource_id || '—'}</td>
                <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate" title={log.user_email}>{log.user_email || '—'}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{log.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {meta.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">{t('auditPageOf', { page, pages: meta.pages, total: meta.total })}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:border-primary text-slate-600 transition-colors">{t('auditPrev')}</button>
              <button disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:border-primary text-slate-600 transition-colors">{t('auditNext')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
