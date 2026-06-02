/**
 * ToastProvider.tsx — mounts the sonner Toaster with app-themed styling.
 * Bottom-right placement, rich colors; rendered once at the app root.
 */
import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          fontSize: '13px',
          color: '#1a1a2e',
          boxShadow: '0 8px 24px rgba(138,23,80,0.10)',
        },
        className: 'font-sans',
      }}
      richColors
    />
  );
}
