/**
 * CertExpiryBanner.tsx – Top banner warning when any node has expiring/expired certs
 * Dependencies: react
 */
import { useState } from 'react';

interface Props {
  expiringCount: number;
  expiredCount: number;
}

export function CertExpiryBanner({ expiringCount, expiredCount }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (expiringCount === 0 && expiredCount === 0)) return null;

  const tone = expiredCount > 0 ? 'danger' : 'warn';
  const color = tone === 'danger' ? '#ef4444' : '#f5a623';
  const bg    = tone === 'danger' ? '#fef2f2' : '#fff7ed';

  const messages: string[] = [];
  if (expiredCount > 0)  messages.push(`${expiredCount} certificate${expiredCount === 1 ? ' has' : 's have'} expired`);
  if (expiringCount > 0) messages.push(`${expiringCount} expire${expiringCount === 1 ? 's' : ''} within 30 days`);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 28px',
      background: bg, borderBottom: `1px solid ${color}55`,
      color, fontSize: '12px', fontWeight: 600,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
        {tone === 'danger' ? 'error' : 'warning'}
      </span>
      <span>{messages.join(' · ')}</span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warning"
        style={{
          marginLeft: 'auto', border: 'none', background: 'transparent',
          cursor: 'pointer', padding: '4px', color,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
      </button>
    </div>
  );
}
