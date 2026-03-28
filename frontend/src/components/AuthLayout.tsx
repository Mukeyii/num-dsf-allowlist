/**
 * AuthLayout.tsx – Shared layout for all auth pages
 * Centered card on lavender-gray background.
 * Indigo "dsf." logo, environment badge, narrow white card.
 */
import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const ENV       = import.meta.env.VITE_DSF_ENVIRONMENT || 'TEST';
const ENV_COLOR = ENV === 'PRODUCTION' ? '#4a90d9' : '#3ecfb2';

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#f0f2f8', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <span
          className="text-3xl font-bold tracking-tight select-none"
          style={{ color: '#6c63ff' }}
        >
          dsf.
        </span>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-sm text-gray-500">Allow List Management</span>
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
        className="w-full max-w-md bg-white p-8"
        style={{
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(108,99,255,0.07)',
          border: '1px solid #e8eaf0',
        }}
      >
        <h1
          className="text-xl font-semibold mb-1"
          style={{ color: '#1a1a2e' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mb-6" style={{ color: '#9b9fad' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs" style={{ color: '#9b9fad' }}>
        Institute of Medical Informatics · University of Muenster
      </p>
    </div>
  );
}
