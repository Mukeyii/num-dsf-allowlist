/**
 * TotpPage.tsx – Step 3b: TOTP code for subsequent logins
 * Accepts both 6-digit TOTP codes and 8-character backup codes.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout }  from '../components/AuthLayout';
import { authApi }     from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { jwtDecode }   from 'jwt-decode';
import { useI18n } from '../stores/i18n.store';

export function TotpPage() {
  const { t } = useI18n();
  const navigate  = useNavigate();
  const location  = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);

  const { tempToken } = (location.state as any) || {};

  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [useBackup, setUseBackup] = useState(false);

  useEffect(() => {
    if (!tempToken) navigate('/login', { replace: true });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().replace(/\s/g, '');
    if (!trimmed) return;
    setLoading(true);
    setError('');

    try {
      const res = await authApi.verifyTotp(tempToken, trimmed);
      const { accessToken } = res.data.data;
      const decoded: any = jwtDecode(accessToken);
      setTokens(accessToken, { id: decoded.sub, email: decoded.email });
      navigate('/app', { replace: true });
    } catch {
      setError(t('totpInvalidCode'));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t('totpTitle')}
      subtitle={useBackup ? t('totpSubtitleBackup') : t('totpSubtitleApp')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#9b9fad' }}>
            {useBackup ? t('totpLabelBackup') : t('totpLabelApp')}
          </label>
          <input
            type="text"
            inputMode={useBackup ? 'text' : 'numeric'}
            maxLength={useBackup ? 8 : 6}
            autoFocus
            value={code}
            onChange={(e) =>
              setCode(useBackup
                ? e.target.value.toUpperCase()
                : e.target.value.replace(/\D/g, ''))
            }
            placeholder={useBackup ? 'XXXXXXXX' : '000000'}
            className="w-full px-3 py-2.5 text-center text-2xl font-mono tracking-widest outline-none"
            style={{
              border: '1.5px solid #e8eaf0',
              borderRadius: '10px',
              color: '#1a1a2e',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#6c63ff')}
            onBlur={(e) => (e.target.style.borderColor = '#e8eaf0')}
          />
        </div>

        {error && <p className="text-xs" style={{ color: '#e05c5c' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length < (useBackup ? 8 : 6)}
          className="w-full py-2.5 text-sm font-medium text-white"
          style={{
            background: '#6c63ff',
            borderRadius: '10px',
            border: 'none',
            opacity: loading || code.length < (useBackup ? 8 : 6) ? 0.6 : 1,
            cursor: loading || code.length < (useBackup ? 8 : 6) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? t('totpVerifying') : t('totpSignIn')}
        </button>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={() => { setUseBackup(!useBackup); setCode(''); setError(''); }}
            className="text-xs underline block mx-auto"
            style={{ color: '#9b9fad', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {useBackup ? t('totpUseApp') : t('totpUseBackup')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-xs block mx-auto"
            style={{ color: '#9b9fad', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('totpStartOver')}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
