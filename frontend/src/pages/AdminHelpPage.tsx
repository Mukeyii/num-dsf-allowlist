/**
 * AdminHelpPage.tsx – Admin reference manual: approval workflow, audit,
 * bundle downloads, cert renewals, mTLS sign-in, support contacts.
 * i18n via t() keys; built-in EN and DE.
 */
import { useI18n } from '../stores/i18n.store';

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: '32px' }}>
      <h2
        style={{
          fontSize: '18px',
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
            height: '20px',
            background: 'var(--primary)',
            borderRadius: '2px',
          }}
        />
        {title}
      </h2>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {children}
      </div>
    </section>
  );
}

export function AdminHelpPage() {
  const { t } = useI18n();

  const TOC_LABEL: Record<string, string> = {
    approval: t('adminHelpToc_approval'),
    crossUser: t('adminHelpToc_crossUser'),
    audit: t('adminHelpToc_audit'),
    download: t('adminHelpToc_download'),
    certs: t('adminHelpToc_certs'),
    mtls: t('adminHelpToc_mtls'),
    support: t('adminHelpToc_support'),
  };

  return (
    <div
      style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
        maxWidth: '900px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '28px', color: 'var(--primary)' }}
        >
          help
        </span>
        <div>
          <h1
            style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('adminHelpTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {t('adminHelpSubtitle')}
          </p>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 24px' }} />

      <nav
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '24px',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          {t('adminHelpToc')}
        </p>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
          }}
        >
          {(
            ['approval', 'crossUser', 'audit', 'download', 'certs', 'mtls', 'support'] as const
          ).map((id) => (
            <li key={id}>
              <a href={`#${id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                {TOC_LABEL[id]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="approval" title={t('adminHelpApprovalTitle')}>
        <p>{t('adminHelpApprovalP1')}</p>
        <p>{t('adminHelpApprovalP2')}</p>
        <ul>
          <li>{t('adminHelpApprovalLi1')}</li>
          <li>{t('adminHelpApprovalLi2')}</li>
          <li>{t('adminHelpApprovalLi3')}</li>
        </ul>
      </Section>

      <Section id="crossUser" title={t('adminHelpCrossUserTitle')}>
        <p>{t('adminHelpCrossUserP1')}</p>
        <p>{t('adminHelpCrossUserP2')}</p>
      </Section>

      <Section id="audit" title={t('adminHelpAuditTitle')}>
        <p>{t('adminHelpAuditP1')}</p>
      </Section>

      <Section id="download" title={t('adminHelpDownloadTitle')}>
        <p>{t('adminHelpDownloadP1')}</p>
      </Section>

      <Section id="certs" title={t('adminHelpCertsTitle')}>
        <p>{t('adminHelpCertsP1')}</p>
      </Section>

      <Section id="mtls" title={t('adminHelpMtlsTitle')}>
        <p>{t('adminHelpMtlsP1')}</p>
      </Section>

      <Section id="support" title={t('adminHelpSupportTitle')}>
        <p>{t('adminHelpSupportP1')}</p>
        <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('footerAffiliation')}
        </p>
      </Section>
    </div>
  );
}
