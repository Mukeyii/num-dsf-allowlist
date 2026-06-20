/**
 * MarketplaceCard.tsx — presentational process card linking to the detail page.
 * Surfaces status, verified badge, required-role chips, DSF-version floor, and
 * an advisory ribbon. No admin actions here — those live on the page/detail.
 * Dependencies: react-router-dom, i18n.store, marketplace.api
 */
import { Link } from 'react-router-dom';
import { useI18n } from '../../stores/i18n.store';
import type { MarketplaceEntry } from '../../api/marketplace.api';

const ACCENT = 'var(--primary)';

const STATUS_PILL: Record<MarketplaceEntry['status'], { bg: string; fg: string }> = {
  APPROVED: { bg: '#dfffe7', fg: '#106a3b' },
  EXPERIMENTAL: { bg: '#fff4d6', fg: '#8a5b00' },
  DEPRECATED: { bg: '#e9ecef', fg: '#495057' },
};

const ADVISORY_COLOR: Record<NonNullable<MarketplaceEntry['advisorySeverity']>, string> = {
  INFO: '#1d4ed8',
  WARNING: '#b45309',
  CRITICAL: '#b91c1c',
};

const MAX_ROLES = 4;

export function MarketplaceCard({ entry }: { entry: MarketplaceEntry }) {
  const { t } = useI18n();
  const pill = STATUS_PILL[entry.status];

  return (
    <Link
      to={`/app/marketplace/${entry.slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {entry.advisorySeverity && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#fff',
            background: ADVISORY_COLOR[entry.advisorySeverity],
            padding: '3px 8px',
            borderRadius: '6px',
            alignSelf: 'flex-start',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
            warning
          </span>
          {entry.advisorySeverity}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.name || entry.gitUrl}
        </span>
        {entry.verified && (
          <span
            className="material-symbols-outlined"
            aria-label={t('marketplaceVerified')}
            title={t('marketplaceVerified')}
            style={{ fontSize: '16px', color: ACCENT }}
          >
            verified
          </span>
        )}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '20px',
            background: pill.bg,
            color: pill.fg,
            marginLeft: 'auto',
          }}
        >
          {entry.status}
        </span>
      </div>

      {entry.description && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {entry.description}
        </p>
      )}

      {entry.requiredRoles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {entry.requiredRoles.slice(0, MAX_ROLES).map((role) => (
            <span
              key={role}
              style={{
                fontSize: '10px',
                fontWeight: 600,
                background: '#fbe3ef',
                color: ACCENT,
                padding: '2px 7px',
                borderRadius: '10px',
              }}
            >
              {role}
            </span>
          ))}
          {entry.requiredRoles.length > MAX_ROLES && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              +{entry.requiredRoles.length - MAX_ROLES}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          marginTop: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        {entry.dsfVersionMin && (
          <span>
            {t('marketplaceDsfVersion')} ≥ {entry.dsfVersionMin}
          </span>
        )}
        <span>★ {entry.stars}</span>
        {entry.license && <span>· {entry.license}</span>}
      </div>
    </Link>
  );
}
