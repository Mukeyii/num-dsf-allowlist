/**
 * LoginPage.tsx – Step 1: Enter email address
 * Checks against backend whitelist. Always gives generic feedback.
 * On success: navigate to /otp with email in router state.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { authApi }    from '../api/auth.api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

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
            style={{ color: '#9b9fad' }}
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
              border: '1px solid #e8eaf0',
              borderRadius: '10px',
              color: '#1a1a2e',
              background: '#fff',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#6c63ff')}
            onBlur={(e) => (e.target.style.borderColor = '#e8eaf0')}
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
    </AuthLayout>
  );
}
