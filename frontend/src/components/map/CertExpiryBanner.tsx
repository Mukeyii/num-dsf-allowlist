/**
 * CertExpiryBanner.tsx – Top banner warning when any node has expiring/expired certs
 * Dependencies: react, i18n.store
 */
import { useState } from 'react';
import { useI18n } from '../../stores/i18n.store';

interface Props {
  expiringCount: number;
  expiredCount: number;
}

export function CertExpiryBanner({ expiringCount, expiredCount }: Props) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (expiringCount === 0 && expiredCount === 0)) return null;

  const tone = expiredCount > 0 ? 'danger' : 'warn';
  const color = tone === 'danger' ? '#ef4444' : '#f5a623';
  const bg = tone === 'danger' ? '#fef2f2' : '#fff7ed';

  const messages: string[] = [];
  if (expiredCount > 0) {
    messages.push(
      expiredCount === 1
        ? t('mapBannerExpiredOne')
        : t('mapBannerExpiredMany', { n: expiredCount }),
    );
  }
  if (expiringCount > 0) {
    messages.push(
      expiringCount === 1
        ? t('mapBannerExpiringOne')
        : t('mapBannerExpiringMany', { n: expiringCount }),
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 28px',
        background: bg,
        borderBottom: `1px solid ${color}55`,
        color,
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
        {tone === 'danger' ? 'error' : 'warning'}
      </span>
      <span>{messages.join(' · ')}</span>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('mapBannerDismiss')}
        style={{
          marginLeft: 'auto',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: '4px',
          color,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          close
        </span>
      </button>
    </div>
  );
}
