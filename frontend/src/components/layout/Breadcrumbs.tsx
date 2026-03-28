/**
 * Breadcrumbs.tsx – Shows navigation path for sub-routes
 * Dependencies: react-router-dom
 */
import { Link, useLocation } from 'react-router-dom';

const ROUTE_LABELS: Record<string, string> = {
  app: 'Dashboard',
  admin: 'Approval Review',
  audit: 'Audit Log',
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  // Only show on sub-routes (not on /app itself)
  if (segments.length <= 1) return null;

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '8px 24px', fontSize: '12px', color: '#9b9fad',
    }}>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const label = ROUTE_LABELS[seg] || seg;
        const isLast = i === segments.length - 1;

        return (
          <span key={path} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {i > 0 && <span style={{ color: '#d4d8e8' }}>/</span>}
            {isLast ? (
              <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{label}</span>
            ) : (
              <Link
                to={path}
                style={{ color: '#6c63ff', textDecoration: 'none', fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
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
