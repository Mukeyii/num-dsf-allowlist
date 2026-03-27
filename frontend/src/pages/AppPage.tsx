/**
 * AppPage.tsx – Placeholder until Phase 5
 * Shows only the identity of the logged-in user.
 */
import { useAuthStore } from '../stores/auth.store';
import { useNavigate }  from 'react-router-dom';
import { authApi }      from '../api/auth.api';

export function AppPage() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await authApi.logout(user?.email || '').catch(() => {});
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: '#f0f2f8', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div
        className="bg-white p-8 text-center"
        style={{ borderRadius: '16px', boxShadow: '0 2px 8px rgba(108,99,255,0.07)', border: '1px solid #e8eaf0' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4"
          style={{ background: '#ede9ff', color: '#6c63ff' }}
        >
          {user?.email?.[0]?.toUpperCase()}
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: '#1a1a2e' }}>{user?.email}</p>
        <p className="text-xs mb-6" style={{ color: '#9b9fad' }}>
          Authentication successful · Phase 5 coming soon
        </p>
        <button
          onClick={handleLogout}
          className="text-xs px-4 py-2"
          style={{
            border: '1px solid #e8eaf0',
            borderRadius: '8px',
            color: '#9b9fad',
            background: 'none',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
