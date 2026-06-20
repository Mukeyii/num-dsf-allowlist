/**
 * MapHeader.tsx – Page title strip for /app/map. Rendered by AppPage above
 * Breadcrumbs so the page title sits ABOVE the Dashboard/Map sub-nav.
 */
import { useMe } from '../../hooks/useMe';
import { useI18n } from '../../stores/i18n.store';

export function MapHeader() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const isAdmin = !!me?.isAdmin;
  return (
    <header style={{ padding: '16px 28px 10px', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '24px', color: 'var(--primary)' }}
          aria-hidden="true"
        >
          hub
        </span>
        <div>
          <h1
            style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('networkMap')}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {isAdmin ? t('mapAdminViewSubtitle') : t('mapMemberViewSubtitle')}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
          {isAdmin ? `🛡 ${t('mapRoleAdmin')}` : `👤 ${t('mapRoleMember')}`}
        </div>
      </div>
    </header>
  );
}
