/**
 * AppFooter.tsx – Persistent footer shown across the app shell.
 * Affiliation only — no personal developer attribution.
 */
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
      <span>{t('footerAffiliation')}</span>
    </footer>
  );
}
