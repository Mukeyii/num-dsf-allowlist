/**
 * Sidebar.tsx – Left navigation 220px
 * Dependencies: auth.store, canvas.store, useInstance, useModals, authApi, react-router-dom
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore }   from '../../stores/auth.store';
import { useCanvasStore } from '../../stores/canvas.store';
import { useThemeStore }  from '../../stores/theme.store';
import { useI18n }        from '../../stores/i18n.store';
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
  const { dark, toggleTheme } = useThemeStore();
  const { lang, setLang, t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dsf-pinned-instances') || '[]'); }
    catch { return []; }
  });

  function togglePin(id: string) {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem('dsf-pinned-instances', JSON.stringify(next));
      return next;
    });
  }

  const initials = (user?.email || '??').slice(0, 2).toUpperCase();
  const activeLabel = instances.find((i: any) => i.id === activeInstanceId)?.label || t('noInstanceSelected');

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
    <aside className="w-[220px] h-screen fixed left-0 top-0 flex flex-col py-6 z-50" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>

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
        <InstanceCreateModal open={showCreate} onClose={() => setShowCreate(false)} />

        {/* Instance List with pin support */}
        <div style={{ padding: '0 4px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', padding: '0 4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t('instances')}
            </label>
            <button
              onClick={() => setShowCreate(true)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#6c63ff', padding: '0' }}
            >
              {t('newInstance')}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflowY: 'auto' }}>
            {[...instances].sort((a: any, b: any) => {
              const aPinned = pinnedIds.includes(a.id);
              const bPinned = pinnedIds.includes(b.id);
              if (aPinned && !bPinned) return -1;
              if (!aPinned && bPinned) return 1;
              return 0;
            }).map((inst: any) => {
              const isPinned = pinnedIds.includes(inst.id);
              const isActive = inst.id === activeInstanceId;
              return (
                <div
                  key={inst.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 8px', borderRadius: '8px', cursor: 'pointer',
                    background: isActive ? '#ede9ff' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => setActiveInstance(inst.id)}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {isPinned && (
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#f5a623', flexShrink: 0 }}>push_pin</span>
                  )}
                  <span style={{
                    flex: 1, fontSize: '11px', fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#6c63ff' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {inst.label}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); togglePin(inst.id); }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}
                    title={isPinned ? 'Unpin' : 'Pin to top'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: isPinned ? '#f5a623' : '#d4d8e8' }}>
                      push_pin
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin link */}
      <div style={{ padding: '0 16px', marginTop: '8px' }}>
        <Link
          to="/app/admin"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 600,
            textDecoration: 'none',
            color: 'var(--text-secondary)',
            background: 'transparent',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = '#6c63ff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>admin_panel_settings</span>
          {t('approvalReview')}
        </Link>
      </div>

      {/* Status link */}
      <div style={{ padding: '0 16px', marginTop: '4px' }}>
        <Link
          to="/app/status"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 600,
            textDecoration: 'none',
            color: 'var(--text-secondary)',
            background: 'transparent',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = '#6c63ff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dashboard</span>
          {t('status')}
        </Link>
      </div>

      {/* Dark Mode Toggle */}
      <div style={{ padding: '0 16px', marginTop: '4px' }}>
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 600, width: '100%',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', background: 'transparent',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {dark ? 'light_mode' : 'dark_mode'}
          </span>
          {dark ? t('lightMode') : t('darkMode')}
        </button>
      </div>

      {/* Language Toggle */}
      <div style={{ padding: '0 16px', marginTop: '4px' }}>
        <button
          onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 600, width: '100%',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', background: 'transparent',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>translate</span>
          {lang === 'en' ? 'Deutsch' : 'English'}
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Partner Logos */}
      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <a href="https://www.medizin.uni-muenster.de/imi/das-institut.html" target="_blank" rel="noopener noreferrer">
            <img src="/logos/IMI-Logo-grad-eng.png" alt="IMI" style={{ height: '30px' }} />
          </a>
          <a href="https://medic.uni-muenster.de/" target="_blank" rel="noopener noreferrer">
            <img src="/logos/Logo_MeDIC_RGB_1000pxl_WEB_transp.png" alt="MeDIC" style={{ height: '28px' }} />
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <img src="/logos/NUM-LOGO-POS-DE-RGB_neu.png" alt="NUM" style={{ height: '22px' }} />
          <img src="/logos/dsf-logo.svg" alt="DSF" style={{ height: '22px' }} />
        </div>
      </div>

      {/* User Identity + Logout */}
      <div className="px-3">
        {/* User Card */}
        <div className="p-4 rounded-xl mb-3" style={{ background: 'var(--bg-hover)' }}>
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
            background: 'var(--bg-card)',
            border: `1px solid ${logoutHover ? '#ef4444' : 'var(--border)'}`,
            color: logoutHover ? '#ef4444' : 'var(--text-secondary)',
          }}
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>{t('signOut')}</span>
        </button>
      </div>
    </aside>
  );
}
