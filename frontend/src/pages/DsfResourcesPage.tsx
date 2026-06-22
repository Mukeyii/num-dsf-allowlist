/**
 * DsfResourcesPage.tsx — static reference page linking to the official DSF
 * resources on dsf.dev. Visible to all authenticated users. Every link is
 * external and opens in a new tab.
 * Dependencies: ../stores/i18n.store, ../lib/dsfResources
 */
import { useI18n } from '../stores/i18n.store';
import { DSF_RESOURCES } from '../lib/dsfResources';

export function DsfResourcesPage() {
  const { t } = useI18n();

  return (
    <div
      style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '28px', color: 'var(--primary)' }}
        >
          menu_book
        </span>
        <div>
          <h1
            style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('dsfResourcesTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {t('dsfResourcesSubtitle')}
          </p>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 24px' }} />

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        {t('dsfResourcesIntro')}
      </p>

      {DSF_RESOURCES.map((cat) => (
        <section key={cat.headingKey} style={{ marginBottom: '28px' }}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                width: '4px',
                height: '18px',
                background: 'var(--primary)',
                borderRadius: '2px',
              }}
            />
            {t(cat.headingKey)}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '10px',
            }}
          >
            {cat.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textDecoration: 'none',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {link.title}
                  </p>
                  <p
                    style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}
                  >
                    {t(link.descKey)}
                  </p>
                </div>
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{ fontSize: '18px', color: 'var(--text-muted)', flexShrink: 0 }}
                >
                  open_in_new
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
