/**
 * MarketplaceDetailPage.tsx – per-process detail at /app/marketplace/:slug.
 * Two-panel layout: a DSF-metadata panel and a lifecycle/trust panel. Admins
 * get an "Edit metadata" button opening the extended status/metadata modal.
 * Dependencies: react-router-dom, useMarketplaceEntry, useMe, i18n.store,
 *               MarketplaceEditStatusModal
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMarketplaceEntry } from '../hooks/useMarketplace';
import { useMe } from '../hooks/useMe';
import { useI18n } from '../stores/i18n.store';
import { MarketplaceEditStatusModal } from '../components/modals/MarketplaceEditStatusModal';
import type { MarketplaceDetail } from '../api/marketplace.api';

const ACCENT = '#b01e66';

const STATUS_PILL: Record<MarketplaceDetail['status'], { bg: string; fg: string }> = {
  APPROVED: { bg: '#dfffe7', fg: '#106a3b' },
  EXPERIMENTAL: { bg: '#fff4d6', fg: '#8a5b00' },
  DEPRECATED: { bg: '#e9ecef', fg: '#495057' },
};

const ADVISORY_COLOR: Record<NonNullable<MarketplaceDetail['advisorySeverity']>, string> = {
  INFO: '#1d4ed8',
  WARNING: '#b45309',
  CRITICAL: '#b91c1c',
};

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px',
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: '0 0 14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export function MarketplaceDetailPage() {
  const { t } = useI18n();
  const { slug = '' } = useParams();
  const { data: entry, isLoading } = useMarketplaceEntry(slug);
  const { data: me } = useMe();
  const [editOpen, setEditOpen] = useState(false);

  const isAdmin = !!me?.isAdmin;

  if (isLoading) {
    return (
      <div style={{ flex: 1, padding: '32px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('loading')}</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div
        style={{
          flex: 1,
          padding: '64px 32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}
        >
          search_off
        </span>
        {t('marketplaceNotFound')}
      </div>
    );
  }

  const pill = STATUS_PILL[entry.status];

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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: ACCENT }}>
          deployed_code
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1
              style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
            >
              {entry.name || entry.gitUrl}
            </h1>
            {entry.verified && (
              <span
                className="material-symbols-outlined"
                aria-label={t('marketplaceVerified')}
                title={t('marketplaceVerified')}
                style={{ fontSize: '20px', color: ACCENT }}
              >
                verified
              </span>
            )}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                background: pill.bg,
                color: pill.fg,
              }}
            >
              {entry.status}
            </span>
          </div>
          {entry.description && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
              {entry.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
            <a
              href={entry.gitUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: ACCENT, textDecoration: 'none', fontWeight: 600 }}
            >
              ↗ GitHub
            </a>
            {entry.homepage && (
              <a
                href={entry.homepage}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#6c63ff', textDecoration: 'none' }}
              >
                ↗ {t('marketplaceDocs')}
              </a>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditOpen(true)}
            style={{
              padding: '7px 16px',
              borderRadius: '10px',
              border: 'none',
              background: ACCENT,
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              edit
            </span>
            {t('marketplaceEditMeta')}
          </button>
        )}
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0' }} />

      {/* Two-panel layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* DSF-metadata panel */}
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>{t('marketplaceDsfMetadata')}</h2>

          <Field label={t('marketplaceProcessId')}>
            {entry.processIdentifiers.length > 0 ? (
              <ChipList items={entry.processIdentifiers} mono />
            ) : (
              <Dash />
            )}
          </Field>

          <Field label={t('marketplaceDsfVersion')}>
            {entry.dsfVersionMin ? <span>≥ {entry.dsfVersionMin}</span> : <Dash />}
          </Field>

          <Field label={t('marketplaceRequiredRoles')}>
            {entry.requiredRoles.length > 0 ? (
              <ChipList items={entry.requiredRoles} accent />
            ) : (
              <Dash />
            )}
          </Field>

          <Field label={t('marketplaceMessageNames')}>
            {entry.messageNames.length > 0 ? (
              <ChipList items={entry.messageNames} mono />
            ) : (
              <Dash />
            )}
          </Field>

          <Field label={t('marketplaceArtifact')}>
            {entry.artifactUrl ? (
              <a
                href={entry.artifactUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: ACCENT, wordBreak: 'break-all' }}
              >
                {entry.artifactUrl}
              </a>
            ) : (
              <Dash />
            )}
          </Field>

          <Field label={t('marketplaceMetaSource')}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#eef0f4',
                color: '#5d6470',
              }}
            >
              {entry.metadataSource}
            </span>
          </Field>
        </section>

        {/* Lifecycle/trust panel */}
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>{t('marketplaceLifecycleTrust')}</h2>

          {entry.advisorySeverity && (
            <div
              style={{
                background: ADVISORY_COLOR[entry.advisorySeverity],
                color: '#fff',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  warning
                </span>
                {t('marketplaceAdvisory')} · {entry.advisorySeverity}
              </div>
              {entry.advisoryText && (
                <p style={{ margin: '6px 0 0', fontSize: '12px' }}>{entry.advisoryText}</p>
              )}
            </div>
          )}

          {/* Trust badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {entry.licenseOk && (
              <Badge bg="#dfffe7" fg="#106a3b">
                {t('marketplaceLicenseOk')}
                {entry.license ? ` · ${entry.license}` : ''}
              </Badge>
            )}
            {entry.stale && (
              <Badge bg="#fde7e7" fg="#a01919">
                {t('marketplaceStale')}
              </Badge>
            )}
          </div>

          <Field label={t('marketplaceVersionHistory')}>
            {entry.releases.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {entry.releases.map((r) => (
                  <li
                    key={r.tag}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '12px',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.tag}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {r.publishedAt ? r.publishedAt.slice(0, 10) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Dash />
            )}
          </Field>

          {/* Repo stats */}
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '4px',
            }}
          >
            <span>★ {entry.stars}</span>
            <span>⑂ {entry.forks}</span>
            <span>ⓘ {entry.openIssues}</span>
            {entry.language && <span>{entry.language}</span>}
            {entry.lastCommitAt && <span>{entry.lastCommitAt.slice(0, 10)}</span>}
          </div>
        </section>
      </div>

      {isAdmin && (
        <MarketplaceEditStatusModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          entryId={entry.id}
          currentStatus={entry.status}
          slug={entry.slug}
          entry={entry}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '5px',
        }}
      >
        {label}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{children}</div>
    </div>
  );
}

function ChipList({ items, mono, accent }: { items: string[]; mono?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {items.map((it) => (
        <span
          key={it}
          style={{
            fontSize: '11px',
            fontWeight: accent ? 600 : 400,
            background: accent ? '#fbe3ef' : '#eef0f4',
            color: accent ? ACCENT : '#5d6470',
            padding: '2px 7px',
            borderRadius: '8px',
            fontFamily: mono ? 'monospace' : undefined,
          }}
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: '6px',
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}

function Dash() {
  return <span style={{ color: 'var(--text-muted)' }}>—</span>;
}
