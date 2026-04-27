/**
 * LoginPage.tsx – Step 1: Enter email address
 * Checks against backend whitelist. Always gives generic feedback.
 * On success: navigate to /otp with email in router state.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { authApi }    from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { jwtDecode }   from 'jwt-decode';

export function LoginPage() {
  const navigate  = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      await authApi.requestOtp(email.trim().toLowerCase());
      navigate('/otp', { state: { email: email.trim().toLowerCase() } });
    } catch {
      navigate('/otp', { state: { email: email.trim().toLowerCase() } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Enter your email to receive a one-time code."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@hospital.de"
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
          <p className="text-xs" style={{ color: '#e05c5c' }}>{error}</p>
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
          {loading ? 'Sending code…' : 'Send code →'}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-[11px] text-slate-500 mb-2 text-center">
          Or, if your browser has a registered client certificate:
        </p>
        {certError && (
          <p className="text-xs mb-2 text-center" style={{ color: '#e05c5c' }}>{certError}</p>
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
              setCertError(err?.response?.data?.error?.message || 'Client-certificate sign-in failed.');
            } finally {
              setCertLoading(false);
            }
          }}
          className="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          style={{ cursor: certLoading ? 'not-allowed' : 'pointer', opacity: certLoading ? 0.6 : 1 }}
        >
          {certLoading ? 'Signing in…' : 'Sign in with client certificate'}
        </button>
      </div>
    </AuthLayout>
  );
}
