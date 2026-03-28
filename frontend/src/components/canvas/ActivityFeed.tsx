/**
 * ActivityFeed.tsx – Compact floating activity feed from audit log
 * Dependencies: TanStack Query, entities.api, canvas.store
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/entities.api';
import { useCanvasStore } from '../../stores/canvas.store';

const OP_STYLES: Record<string, { icon: string; color: string }> = {
  CREATE: { icon: 'add_circle', color: '#22c55e' },
  UPDATE: { icon: 'edit', color: '#6c63ff' },
  DELETE: { icon: 'remove_circle', color: '#ef4444' },
  APPROVE: { icon: 'check_circle', color: '#22c55e' },
  REJECT: { icon: 'cancel', color: '#ef4444' },
  LOGIN: { icon: 'login', color: '#4a90d9' },
  DEFAULT: { icon: 'info', color: 'var(--text-muted)' },
};

function relTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  operation: string;
  resource_type: string;
}

export function ActivityFeed() {
  const [expanded, setExpanded] = useState(false);
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);

  const { data } = useQuery({
    queryKey: ['activity-feed', activeInstanceId],
    queryFn: async () => {
      if (!activeInstanceId) return [];
      const res = await api(activeInstanceId).getAuditLog('limit=8&page=1');
      return (res.data?.data as AuditEntry[]) || [];
    },
    enabled: !!activeInstanceId,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const entries: AuditEntry[] = data || [];

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '300px',
      zIndex: 30, fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {expanded && (
        <div style={{
          width: '280px', marginBottom: '8px',
          background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--bg-page)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Activity</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{entries.length} entries</span>
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {entries.map((log) => {
              const style = OP_STYLES[log.operation] ?? OP_STYLES.DEFAULT;
              return (
                <div key={log.id} style={{
                  display: 'flex', gap: '8px', padding: '8px 14px',
                  borderBottom: '1px solid var(--bg-hover)',
                }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '14px', color: style.color, flexShrink: 0, marginTop: '1px' }}
                  >
                    {style.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-primary)' }}>
                      <strong>{log.operation}</strong> {log.resource_type}
                    </p>
                    <p style={{ margin: 0, fontSize: '9px', color: 'var(--text-muted)' }}>{relTime(log.timestamp)}</p>
                  </div>
                </div>
              );
            })}
            {entries.length === 0 && (
              <p style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                No activity yet.
              </p>
            )}
          </div>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: '#6c63ff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(108,99,255,0.3)', float: 'right',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#fff' }}>
          {expanded ? 'close' : 'history'}
        </span>
      </button>
    </div>
  );
}
