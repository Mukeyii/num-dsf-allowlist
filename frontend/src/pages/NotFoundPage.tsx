/**
 * NotFoundPage.tsx – 404 catch-all page
 * Dependencies: react-router-dom (Link)
 */
import { Link } from 'react-router-dom';
import { useI18n } from '../stores/i18n.store';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-page)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '64px', color: 'var(--text-muted)', marginBottom: '24px' }}
      >
        search_off
      </span>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}
      >
        {t('pageNotFound')}
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>
        {t('notFoundMessage')}
      </p>
      <Link
        to="/app"
        style={{
          padding: '10px 24px',
          background: '#6c63ff',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        {t('notFoundBackBtn')}
      </Link>
    </div>
  );
}
