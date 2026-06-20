/**
 * Breadcrumbs.tsx – Shows navigation path for sub-routes
 * Dependencies: react-router-dom
 */
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../stores/i18n.store';

export function Breadcrumbs() {
  const { t } = useI18n();
  const ROUTE_LABELS: Record<string, string> = {
    app: t('dashboard'),
    admin: t('approvalReview'),
    audit: t('auditLog'),
    map: t('networkMap'),
    users: t('sidebarUserManagement'),
    promotions: t('sidebarPromotions'),
    help: t('adminHelpLink'),
    status: t('status'),
  };
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  // Only show on sub-routes (not on /app itself)
  if (segments.length <= 1) return null;

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 30px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        background: 'var(--bg-card)',
      }}
    >
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const label = ROUTE_LABELS[seg] || seg;
        const isLast = i === segments.length - 1;

        return (
          <span key={path} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {i > 0 && <span style={{ color: 'var(--border)' }}>/</span>}
            {isLast ? (
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
            ) : (
              <Link
                to={path}
                style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
