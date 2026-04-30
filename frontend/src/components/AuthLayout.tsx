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
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: 'var(--bg-page)', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* IMI Logo — prominent, above card */}
      <div style={{ marginBottom: '24px' }}>
        <a href="https://www.medizin.uni-muenster.de/imi/das-institut.html" target="_blank" rel="noopener noreferrer">
          <img
            src="/logos/IMI-Logo-grad-eng.png"
            alt="Institute of Medical Informatics"
            style={{ height: '80px', display: 'block' }}
          />
        </a>
      </div>

      {/* App title + environment */}
      <div className="mb-6 text-center">
        <span className="text-3xl font-bold tracking-tight select-none" style={{ color: '#6c63ff' }}>
          dsf.
        </span>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Allow List Management</span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{ color: ENV_COLOR, borderColor: ENV_COLOR + '44', background: ENV_COLOR + '11' }}
          >
            {ENV}
          </span>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md p-8"
        style={{
          borderRadius: '16px',
          background: 'var(--bg-card)',
          boxShadow: '0 2px 8px rgba(108,99,255,0.07)',
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

      {/* Institutional Logos — 2 rows, large enough to read */}
      <div style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '600px' }}>
        {/* Row 1: Uni Münster + Med. Fakultät */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <img src="https://medic.uni-muenster.de/wp-content/uploads/2023/11/Logo_UniMuenster_2023_RGB-640x177.jpg" alt="Universität Münster" style={{ height: '48px', borderRadius: '4px' }} />
          <img src="https://medic.uni-muenster.de/wp-content/uploads/2022/11/Logo-Medizinische-Fakultaet-640x325.jpg" alt="Medizinische Fakultät" style={{ height: '48px', borderRadius: '4px' }} />
        </div>
        {/* Row 2: UKM + DIZ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <img src="https://medic.uni-muenster.de/wp-content/uploads/2022/11/Logo-UKM-Muenster-640x561.jpg" alt="UKM Münster" style={{ height: '48px', borderRadius: '4px' }} />
          <img src="https://medic.uni-muenster.de/wp-content/uploads/2025/02/csm_DIZ_deutsch_RGB_6828fe1a4f-640x371.jpg" alt="DIZ" style={{ height: '48px', borderRadius: '4px' }} />
        </div>
        {/* Row 3: MeDIC + NUM */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <a href="https://medic.uni-muenster.de/" target="_blank" rel="noopener noreferrer">
            <img src="/logos/Logo_MeDIC_RGB_1000pxl_WEB_transp.png" alt="MeDIC" style={{ height: '44px' }} />
          </a>
          <img src="https://medic.uni-muenster.de/wp-content/uploads/2025/09/NUM-LOGO-POS-RGB_neu-640x296.png" alt="NUM" style={{ height: '40px' }} />
        </div>
      </div>

      {/* Impressum + Footer */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
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
