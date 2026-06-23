/**
 * CertStatusPage.tsx — shown by AuthBootstrap in the cert deployment variant
 * when client-certificate sign-in cannot complete. There is no OTP fallback in
 * this variant, so this screen explains the state and offers a reload.
 * Dependencies: ../stores/i18n.store, ../lib/authMode
 */
import { useI18n } from '../stores/i18n.store';
import type { TranslationKey } from '../i18n/en';
import { reauthRedirect } from '../lib/authMode';

const CODE_KEY: Record<string, TranslationKey> = {
  NO_CLIENT_CERT: 'certStatusNoCert',
  CERT_NOT_REGISTERED: 'certStatusNotRegistered',
  NO_INSTANCE: 'certStatusNoInstance',
  NO_USER: 'certStatusNoInstance',
  ACCOUNT_LOCKED: 'certStatusLocked',
};

export function CertStatusPage({ code }: { code: string | null }) {
  const { t } = useI18n();
  const messageKey: TranslationKey =
    code === null ? 'certStatusChecking' : (CODE_KEY[code] ?? 'certStatusGeneric');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '420px', textAlign: 'center' }}>
        <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>dsf.</span>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '16px 0 8px',
          }}
        >
          {t('certStatusTitle')}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {t(messageKey)}
        </p>
        {code !== null && (
          <button
            onClick={() => reauthRedirect()}
            style={{
              marginTop: '20px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('certStatusRetry')}
          </button>
        )}
      </div>
    </div>
  );
}
