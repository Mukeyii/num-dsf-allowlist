/**
 * Sidebar.tsx – Left navigation 220px
 * Dependencies: auth.store, canvas.store, useInstance, useModals, authApi, react-router-dom
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore }   from '../../stores/auth.store';
import { useCanvasStore } from '../../stores/canvas.store';
import { useInstances }   from '../../hooks/useInstance';
import { authApi }        from '../../api/auth.api';
import { InstanceCreateModal } from '../modals/InstanceCreateModal';

export function Sidebar() {
  const navigate          = useNavigate();
  const user              = useAuthStore((s) => s.user);
  const clearAuth         = useAuthStore((s) => s.clearAuth);
  const { data: instances = [] } = useInstances();
  const activeInstanceId  = useCanvasStore((s) => s.activeInstanceId);
  const setActiveInstance = useCanvasStore((s) => s.setActiveInstance);
  const [showCreate, setShowCreate] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);

  const initials = (user?.email || '??').slice(0, 2).toUpperCase();
  const activeLabel = instances.find((i: any) => i.id === activeInstanceId)?.label || 'No instance selected';

  async function handleLogout() {
    try {
      if (user?.email) {
        await authApi.logout(user.email);
      }
    } catch {
      // Logout API failure should not block client-side cleanup
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  }

  return (
    <aside className="w-[220px] h-screen fixed left-0 top-0 bg-white border-r border-slate-100 flex flex-col py-6 z-50">

      {/* Logo / Title */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-700 text-[22px]">shield</span>
          <div>
            <p className="text-xs font-bold text-indigo-700 leading-tight">DSF Allow List</p>
            <p className="text-[10px] text-slate-400 leading-tight">Management Portal</p>
          </div>
        </div>
      </div>

      {/* Instance Switcher */}
      <div className="px-3 mb-2">
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors mb-2 px-4"
        >
          + New instance
        </button>
        <InstanceCreateModal open={showCreate} onClose={() => setShowCreate(false)} />
        <div className="px-4">
          <select
            value={activeInstanceId || ''}
            onChange={e => setActiveInstance(e.target.value)}
            className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-100
                       rounded-lg px-2 py-1.5 outline-none focus:border-indigo-300"
          >
            {instances.map((inst: any) => (
              <option key={inst.id} value={inst.id}>{inst.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Identity + Logout */}
      <div className="px-3">
        {/* User Card */}
        <div className="p-4 bg-slate-50 rounded-xl mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.email}</p>
              <p className="text-[10px] text-slate-500 truncate mono-id">{activeLabel}</p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-left transition-colors duration-200"
          style={{
            background: 'white',
            border: `1px solid ${logoutHover ? '#ef4444' : '#e2e8f0'}`,
            color: logoutHover ? '#ef4444' : '#64748b',
          }}
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
