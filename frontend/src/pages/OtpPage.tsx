/**
 * OtpPage.tsx – Step 2: Enter 6-digit OTP code
 * Email from router state. Auto-submit when 6 digits entered.
 * requiresTotpSetup=true → /totp-setup, else → /totp
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { authApi } from '../api/auth.api';
import { useI18n } from '../stores/i18n.store';

export function OtpPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as any)?.email || '';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
    inputRefs.current[0]?.focus();
  }, [email, navigate]);

  useEffect(
    () => () => {
      if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
    },
    [],
  );

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every(Boolean)) {
      submitCode(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      submitCode(pasted);
    }
  }

  async function submitCode(code: string) {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp(email, code);
      const { tempToken, requiresTotpSetup } = res.data.data;
      if (requiresTotpSetup) {
        navigate('/totp-setup', { state: { tempToken, email } });
      } else {
        navigate('/totp', { state: { tempToken, email } });
      }
    } catch {
      setError(t('otpInvalidCode'));
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResent(false);
    await authApi.requestOtp(email).catch(() => {});
    setResent(true);
    setDigits(Array(6).fill(''));
    inputRefs.current[0]?.focus();
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
    resendTimerRef.current = setTimeout(() => setResent(false), 4000);
  }

  return (
    <AuthLayout title={t('otpTitle')} subtitle={t('otpSubtitle', { email })}>
      <div className="space-y-5">
        {/* 6 Digit-Inputs */}
        <div
          className="flex gap-2 justify-between"
          role="group"
          aria-label={t('otpCodeAria')}
          onPaste={handlePaste}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              aria-label={t('otpDigitAria', { n: i + 1 })}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className="text-center text-xl font-semibold outline-none transition-all"
              style={{
                width: '48px',
                height: '56px',
                border: `1.5px solid ${d ? 'var(--accent)' : '#e8eaf0'}`,
                borderRadius: '10px',
                color: '#1a1a2e',
                background: d ? '#ede9ff' : '#fff',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = digits[i] ? 'var(--accent)' : '#e8eaf0')}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-center" style={{ color: '#e05c5c' }}>
            {error}
          </p>
        )}

        {loading && (
          <p className="text-xs text-center" style={{ color: '#9b9fad' }}>
            {t('otpVerifying')}
          </p>
        )}

        {/* Resend */}
        <div className="text-center">
          {resent ? (
            <span className="text-xs" style={{ color: '#4caf8a' }}>
              {t('otpResent')}
            </span>
          ) : (
            <button
              onClick={handleResend}
              className="text-xs underline"
              style={{ color: '#9b9fad', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {t('otpResend')}
            </button>
          )}
        </div>

        {/* Back */}
        <div className="text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-xs"
            style={{ color: '#9b9fad', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('otpDifferentEmail')}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
