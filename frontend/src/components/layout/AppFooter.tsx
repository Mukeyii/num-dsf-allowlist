/**
 * AppFooter.tsx – Persistent footer shown across the app shell.
 * Developer attribution + affiliation, plus a discreet build year.
 */
import { useI18n } from '../../stores/i18n.store';

export function AppFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
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
      <span>© {year} {t('footerDeveloper')}</span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <span>{t('footerAffiliation')}</span>
    </footer>
  );
}
