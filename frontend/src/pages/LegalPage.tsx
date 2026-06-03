/**
 * LegalPage.tsx — Bundle-verification disclaimer + general legal notes.
 *
 * Routed at /app/legal. Linked from AppFooter; also surfaced from the
 * DownloadModal's acknowledgment checkbox. Strings live in i18n/{de,en}.ts
 * so the page tracks the active locale.
 */
import { useI18n } from '../stores/i18n.store';

export function LegalPage() {
  const { t } = useI18n();
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('legalPageTitle')}
      </h1>
      <section
        className="space-y-4 text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('bundleDisclaimerHeading')}
        </h2>
        <p>{t('bundleDisclaimerBody')}</p>
      </section>
    </div>
  );
}
