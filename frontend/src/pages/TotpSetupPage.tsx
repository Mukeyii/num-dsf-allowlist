/**
 * TotpSetupPage.tsx – Step 3a: TOTP setup on very first login
 * Shows QR code to scan with authenticator app.
 * After confirmation: show backup codes + continue to AppPage.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout }  from '../components/AuthLayout';
import { authApi }     from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { jwtDecode }   from 'jwt-decode';

export function TotpSetupPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);

  const { tempToken, email } = (location.state as any) || {};

  const [step, setStep]           = useState<'qr' | 'confirm' | 'backup'>('qr');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [code, setCode]           = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!tempToken) { navigate('/login', { replace: true }); return; }
    loadQrCode();
  }, []);

  async function loadQrCode() {
    setLoading(true);
    try {
      const res = await authApi.setupTotp(tempToken);
      setQrCodeUrl(res.data.data.qrCodeUrl);
      setStep('qr');
    } catch {
      setError('Session expired. Please sign in again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await authApi.confirmTotp(tempToken, code);
      const { accessToken, backupCodes: codes } = res.data.data;
      setBackupCodes(codes);
      const decoded: any = jwtDecode(accessToken);
      setTokens(accessToken, { id: decoded.sub, email: decoded.email });
      setStep('backup');
    } catch {
      setError('Invalid code. Try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  // QR code step
  if (step === 'qr') return (
    <AuthLayout
      title="Set up two-factor authentication"
      subtitle="Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)"
    >
      <div className="space-y-5">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="text-sm" style={{ color: '#9b9fad' }}>Loading QR code…</div>
          </div>
        )}
        {qrCodeUrl && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="p-3 rounded-xl"
              style={{ border: '1px solid #e8eaf0', background: '#fff' }}
            >
              <img src={qrCodeUrl} alt="TOTP QR Code" width={200} height={200} />
            </div>
            <p className="text-xs text-center" style={{ color: '#9b9fad' }}>
              After scanning, enter the 6-digit code shown in your app.
            </p>
            <button
              onClick={() => setStep('confirm')}
              className="w-full py-2.5 text-sm font-medium text-white"
              style={{ background: '#6c63ff', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
            >
              I've scanned the QR code →
            </button>
          </div>
        )}
        {error && <p className="text-xs text-center" style={{ color: '#e05c5c' }}>{error}</p>}
      </div>
    </AuthLayout>
  );

  // TOTP confirm step
  if (step === 'confirm') return (
    <AuthLayout
      title="Verify your authenticator"
      subtitle="Enter the 6-digit code from your authenticator app to complete setup."
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#9b9fad' }}>
            Authenticator code
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
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
          disabled={code.length !== 6 || loading}
          className="w-full py-2.5 text-sm font-medium text-white"
          style={{
            background: '#6c63ff',
            borderRadius: '10px',
            border: 'none',
            opacity: code.length !== 6 || loading ? 0.6 : 1,
            cursor: code.length !== 6 || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Verifying…' : 'Complete setup →'}
        </button>

        <button
          type="button"
          onClick={() => setStep('qr')}
          className="w-full text-xs"
          style={{ color: '#9b9fad', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Back to QR code
        </button>
      </form>
    </AuthLayout>
  );

  // Backup codes step
  return (
    <AuthLayout
      title="Save your backup codes"
      subtitle="Store these codes somewhere safe. Each code can only be used once if you lose access to your authenticator."
    >
      <div className="space-y-5">
        <div
          className="p-4 rounded-xl grid grid-cols-2 gap-2"
          style={{ background: '#f0f2f8', border: '1px solid #e8eaf0' }}
        >
          {backupCodes.map((c, i) => (
            <code
              key={i}
              className="text-sm text-center py-1 px-2 rounded font-mono tracking-widest"
              style={{ background: '#fff', color: '#6c63ff', border: '1px solid #e8eaf0' }}
            >
              {c}
            </code>
          ))}
        </div>

        <div
          className="text-xs p-3 rounded-lg"
          style={{ background: '#fff8e8', color: '#854f0b', border: '1px solid #f5a62333' }}
        >
          ⚠ These codes will not be shown again. Copy them now.
        </div>

        <button
          onClick={() => navigate('/app', { replace: true })}
          className="w-full py-2.5 text-sm font-medium text-white"
          style={{ background: '#6c63ff', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
        >
          I've saved my codes → Continue
        </button>
      </div>
    </AuthLayout>
  );
}
