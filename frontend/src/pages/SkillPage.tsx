/**
 * SkillPage.tsx — presents the downloadable `dsf-process-creator` Claude Code
 * skill: what it is, what it ships, how to install it, and a download of the
 * packaged skill (.zip served from /downloads). Visible to all authenticated
 * users. The Claude mark is a static asset under /logos.
 * Dependencies: ../stores/i18n.store
 */
import { useI18n } from '../stores/i18n.store';

const SKILL_DOWNLOAD = '/downloads/dsf-process-creator-skill.zip';
const API_V2_DOCS = 'https://dsf.dev/process-development/api-v2/';

export function SkillPage() {
  const { t } = useI18n();

  const inside = [
    t('processSkillWhat1'),
    t('processSkillWhat2'),
    t('processSkillWhat3'),
    t('processSkillWhat4'),
  ];
  const steps = [t('processSkillHow1'), t('processSkillHow2'), t('processSkillHow3')];

  return (
    <div
      style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
        <img src="/logos/claude-logo.svg" alt="Claude" width={34} height={34} />
        <div>
          <h1
            style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('processSkillTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {t('processSkillSubtitle')}
          </p>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 24px' }} />

      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          margin: '0 0 24px',
          maxWidth: '760px',
          lineHeight: 1.6,
        }}
      >
        {t('processSkillIntro')}
      </p>

      {/* Download card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '28px',
        }}
      >
        <img src="/logos/claude-logo.svg" alt="" aria-hidden="true" width={40} height={40} />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            dsf-process-creator
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('processSkillDownloadHint')}
          </p>
        </div>
        <a
          href={SKILL_DOWNLOAD}
          download
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px' }}
            aria-hidden="true"
          >
            download
          </span>
          {t('processSkillDownload')}
        </a>
      </div>

      {/* What's inside */}
      <section style={{ marginBottom: '28px' }}>
        <h2 style={sectionHeading}>
          <span style={accentBar} />
          {t('processSkillWhatTitle')}
        </h2>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '8px' }}>
          {inside.map((item, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: '10px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}
              >
                check_circle
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* How to use */}
      <section style={{ marginBottom: '28px' }}>
        <h2 style={sectionHeading}>
          <span style={accentBar} />
          {t('processSkillHowTitle')}
        </h2>
        <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
          {steps.map((step, i) => (
            <li
              key={i}
              style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}
            >
              {step}
            </li>
          ))}
        </ol>
      </section>

      {/* Footer: docs link + attribution */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderTop: '1px solid var(--border)',
          paddingTop: '16px',
        }}
      >
        <a
          href={API_V2_DOCS}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--primary)',
            textDecoration: 'none',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px' }}
            aria-hidden="true"
          >
            open_in_new
          </span>
          {t('processSkillDocsLinkLabel')}
        </a>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <img src="/logos/claude-logo.svg" alt="" aria-hidden="true" width={14} height={14} />
          {t('processSkillBuiltWith')}
        </span>
      </div>
    </div>
  );
}

const sectionHeading: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: '0 0 12px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const accentBar: React.CSSProperties = {
  width: '4px',
  height: '18px',
  background: 'var(--primary)',
  borderRadius: '2px',
};
