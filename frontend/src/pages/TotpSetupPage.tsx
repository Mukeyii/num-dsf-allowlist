/**
 * TotpSetupPage.tsx – Step 3a: TOTP setup on very first login
 * Shows QR code to scan with authenticator app.
 * After confirmation: show backup codes + continue to AppPage.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { jwtDecode } from 'jwt-decode';
import { useI18n } from '../stores/i18n.store';

export function TotpSetupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);

  const { tempToken } = (location.state as any) || {};

  const [step, setStep] = useState<'qr' | 'confirm' | 'backup'>('qr');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tempToken) {
      navigate('/login', { replace: true });
      return;
    }
    setLoading(true);
    authApi
      .setupTotp(tempToken)
      .then((res) => {
        setQrCodeUrl(res.data.data.qrCodeUrl);
        setStep('qr');
      })
      .catch(() => setError(t('totpSetupSessionExpired')))
      .finally(() => setLoading(false));
  }, [tempToken, navigate, t]);

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
      setError(t('totpConfirmInvalidCode'));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  // QR code step
  if (step === 'qr')
    return (
      <AuthLayout title={t('totpSetupTitle')} subtitle={t('totpSetupSubtitle')}>
        <div className="space-y-5">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="text-sm" style={{ color: '#9b9fad' }}>
                {t('totpSetupLoadingQr')}
              </div>
            </div>
          )}
          {qrCodeUrl && (
            <div className="flex flex-col items-center gap-4">
              <div
                className="p-3 rounded-xl"
                style={{ border: '1px solid #e8eaf0', background: '#fff' }}
              >
                <img src={qrCodeUrl} alt={t('totpSetupQrAlt')} width={200} height={200} />
              </div>
              <p className="text-xs text-center" style={{ color: '#9b9fad' }}>
                {t('totpSetupQrHint')}
              </p>
              <button
                onClick={() => setStep('confirm')}
                className="w-full py-2.5 text-sm font-medium text-white"
                style={{
                  background: '#6c63ff',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('totpSetupScannedBtn')}
              </button>
            </div>
          )}
          {error && (
            <p className="text-xs text-center" style={{ color: '#e05c5c' }}>
              {error}
            </p>
          )}
        </div>
      </AuthLayout>
    );

  // TOTP confirm step
  if (step === 'confirm')
    return (
      <AuthLayout title={t('totpConfirmTitle')} subtitle={t('totpConfirmSubtitle')}>
        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9b9fad' }}>
              {t('totpConfirmLabel')}
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

          {error && (
            <p className="text-xs" style={{ color: '#e05c5c' }}>
              {error}
            </p>
          )}

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
            {loading ? t('totpConfirmVerifying') : t('totpConfirmCompleteBtn')}
          </button>

          <button
            type="button"
            onClick={() => setStep('qr')}
            className="w-full text-xs"
            style={{ color: '#9b9fad', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('totpConfirmBackToQr')}
          </button>
        </form>
      </AuthLayout>
    );

  // Backup codes step
  return (
    <AuthLayout title={t('totpBackupTitle')} subtitle={t('totpBackupSubtitle')}>
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
          {t('totpBackupWarning')}
        </div>

        <button
          onClick={() => navigate('/app', { replace: true })}
          className="w-full py-2.5 text-sm font-medium text-white"
          style={{ background: '#6c63ff', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
        >
          {t('totpBackupContinueBtn')}
        </button>
      </div>
    </AuthLayout>
  );
}
