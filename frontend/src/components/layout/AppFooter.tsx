/**
 * AppFooter.tsx – Persistent footer shown across the app shell.
 * Affiliation + bundle-verification disclaimer link.
 */
import { Link } from 'react-router-dom';
import { useI18n } from '../../stores/i18n.store';

export function AppFooter() {
  const { t } = useI18n();
  return (
    <footer
      style={{
        flexShrink: 0,
        padding: '8px 24px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}
    >
      <a
        href="https://www.medizin.uni-muenster.de/imi/das-institut.html"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <img
          src="/logos/IMI-Logo-grad-eng.png"
          alt="IMI"
          height={16}
          style={{ display: 'block', opacity: 0.7 }}
        />
      </a>
      <span>{t('footerAffiliation')}</span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <Link to="/app/legal" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
        {t('bundleDisclaimerLinkLabel')}
      </Link>
    </footer>
  );
}
