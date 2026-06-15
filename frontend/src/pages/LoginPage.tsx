/**
 * LoginPage.tsx – Step 1: Enter email address
 * Checks against backend whitelist. Always gives generic feedback.
 * On success: navigate to /otp with email in router state.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { jwtDecode } from 'jwt-decode';
import { useI18n } from '../stores/i18n.store';
import { getErrorMessage } from '../lib/getErrorMessage';

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      await authApi.requestOtp(email.trim().toLowerCase());
      navigate('/otp', { state: { email: email.trim().toLowerCase() } });
    } catch (err: unknown) {
      // No-enumeration: a whitelisted or non-whitelisted email both return 200
      // and proceed to /otp. Only a genuine transport failure (no response) or
      // a 5xx means the request never reached/was processed by the server —
      // surface that and stay on the page. Any other server response navigates.
      const status = (err as { response?: { status?: number } })?.response?.status;
      const transportOrServerError = status == null || status >= 500;
      if (transportOrServerError) {
        setError(getErrorMessage(err, t('loginOtpRequestFailed')));
      } else {
        navigate('/otp', { state: { email: email.trim().toLowerCase() } });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t('signIn')} subtitle={t('loginSubtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('loginEmailLabel')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('loginEmailPlaceholder')}
            className="w-full px-3 py-2.5 text-sm outline-none transition-all"
            style={{
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              background: 'var(--bg-input)',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#6c63ff')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: '#e05c5c' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full py-2.5 text-sm font-medium text-white transition-opacity"
          style={{
            background: '#6c63ff',
            borderRadius: '10px',
            opacity: loading || !email.trim() ? 0.6 : 1,
            cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
        >
          {loading ? t('loginSendingBtn') : t('loginSendBtn')}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-[11px] text-slate-500 mb-2 text-center">{t('loginCertHint')}</p>
        {certError && (
          <p className="text-xs mb-2 text-center" style={{ color: '#e05c5c' }}>
            {certError}
          </p>
        )}
        <button
          type="button"
          disabled={certLoading}
          onClick={async () => {
            setCertLoading(true);
            setCertError('');
            try {
              const res = await authApi.clientCertLogin();
              const { accessToken } = res.data.data;
              const decoded: any = jwtDecode(accessToken);
              setTokens(accessToken, { id: decoded.sub, email: decoded.email });
              navigate('/app', { replace: true });
            } catch (err: any) {
              setCertError(getErrorMessage(err, t('loginCertFailed')));
            } finally {
              setCertLoading(false);
            }
          }}
          className="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          style={{
            cursor: certLoading ? 'not-allowed' : 'pointer',
            opacity: certLoading ? 0.6 : 1,
          }}
        >
          {certLoading ? t('loginCertSigningIn') : t('loginCertBtn')}
        </button>
      </div>
    </AuthLayout>
  );
}
