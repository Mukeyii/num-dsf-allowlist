/**
 * AuthLayout.tsx – Shared layout for all auth pages
 * Centered card with institutional logos and Impressum link.
 */
import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const ENV = import.meta.env.VITE_DSF_ENVIRONMENT || 'TEST';
const ENV_COLOR = ENV === 'PRODUCTION' ? '#4a90d9' : '#115e59';

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative"
      style={{ background: 'var(--bg-page)', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Animated background — aurora blobs in IMI logo palette */}
      <div className="auth-aurora" aria-hidden="true">
        <span />
      </div>

      {/* IMI Logo — prominent, above card */}
      <div style={{ marginBottom: '24px', position: 'relative', zIndex: 1 }}>
        <a
          href="https://www.medizin.uni-muenster.de/imi/das-institut.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/logos/IMI-Logo-grad-eng.png"
            alt="Institute of Medical Informatics"
            style={{ height: '80px', display: 'block' }}
          />
        </a>
      </div>

      {/* App title + environment */}
      <div className="mb-6 text-center" style={{ position: 'relative', zIndex: 1 }}>
        <span className="dsf-wordmark text-4xl font-extrabold tracking-tight select-none">
          dsf.
        </span>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Allow List Management
          </span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{
              color: ENV_COLOR,
              borderColor: ENV_COLOR + '44',
              background: ENV_COLOR + '11',
            }}
          >
            {ENV}
          </span>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md p-8"
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '16px',
          background: 'var(--bg-card)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 8px 32px rgba(176, 30, 102, 0.10), 0 2px 8px rgba(176, 30, 102, 0.05)',
          border: '1px solid var(--border)',
        }}
      >
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>

      {/* Partner Logos — single elegant row with divider */}
      <div
        style={{
          marginTop: '44px',
          width: '100%',
          maxWidth: '560px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Divider with label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            In cooperation with
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Partner row — uniform heights, muted until hover */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: '28px',
            flexWrap: 'wrap',
          }}
        >
          <img
            src="/logos/Logo UKM Münster.PNG"
            alt="UKM Münster"
            style={{ height: '40px', opacity: 0.72, transition: 'opacity 0.2s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.72')}
          />
          <a href="https://medic.uni-muenster.de/" target="_blank" rel="noopener noreferrer">
            <img
              src="/logos/Logo_MeDIC_RGB_1000pxl_WEB_transp.png"
              alt="MeDIC"
              style={{ height: '36px', opacity: 0.72, transition: 'opacity 0.2s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.72')}
            />
          </a>
          <img
            src="/logos/NUM-LOGO-POS-DE-RGB_neu.png"
            alt="NUM"
            style={{ height: '34px', opacity: 0.72, transition: 'opacity 0.2s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.72')}
          />
          <img
            src="/logos/HHN_logo.png"
            alt="Hochschule Heilbronn"
            style={{ height: '36px', opacity: 0.72, transition: 'opacity 0.2s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.72')}
          />
        </div>
      </div>

      {/* Impressum + Footer */}
      <div style={{ marginTop: '24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Institute of Medical Informatics · University of Muenster
        </p>
        <a
          href="https://medic.uni-muenster.de/impressum/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'underline' }}
        >
          Impressum
        </a>
      </div>
    </div>
  );
}
