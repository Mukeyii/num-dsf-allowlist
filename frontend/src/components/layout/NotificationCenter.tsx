/**
 * NotificationCenter.tsx – Bell icon with dropdown notification history
 * Dependencies: notification.store
 */
import { useState, useRef, useEffect } from 'react';
import { useNotificationStore } from '../../stores/notification.store';
import { useI18n } from '../../stores/i18n.store';


const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  success: { icon: 'check_circle', color: '#22c55e' },
  error: { icon: 'error', color: '#ef4444' },
  info: { icon: 'info', color: '#6c63ff' },
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unread, markAllRead, clear } = useNotificationStore();
  const { t } = useI18n();

  function relTime(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return t('relJustNow');
    if (diff < 3600) return t('relAgoMinutes').replace('{n}', String(Math.floor(diff / 60)));
    if (diff < 86400) return t('relAgoHours').replace('{n}', String(Math.floor(diff / 3600)));
    return t('relAgoDays').replace('{n}', String(Math.floor(diff / 86400)));
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleToggle() {
    setOpen(!open);
    if (!open) markAllRead();
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        style={{ position: 'relative', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>notifications</span>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px',
            borderRadius: '50%', background: '#ef4444', color: '#fff',
            fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '320px',
          background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: '400px', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('notifications')}</span>
            {notifications.length > 0 && (
              <button onClick={clear} aria-label="Clear all notifications" style={{ fontSize: '10px', color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer' }}>{t('clearAll')}</button>
            )}
          </div>
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>{t('noNotificationsYet')}</p>
            ) : (
              notifications.map(n => {
                const { icon, color } = TYPE_ICON[n.type];
                return (
                  <div key={n.id} style={{ display: 'flex', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--bg-page)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color, flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.message}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{relTime(n.timestamp)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
