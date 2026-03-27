/**
 * Sidebar.tsx – Left navigation 220px
 */
import { useState } from 'react';
import { useAuthStore }   from '../../stores/auth.store';
import { useCanvasStore } from '../../stores/canvas.store';
import { useInstances }   from '../../hooks/useInstance';
import { InstanceCreateModal } from '../modals/InstanceCreateModal';

const NAV_ITEMS = [
  { id: 'organization', label: 'Organization', icon: 'corporate_fare' },
  { id: 'contacts',     label: 'Contacts',     icon: 'contact_phone'  },
  { id: 'endpoints',    label: 'Endpoints',    icon: 'hub'            },
  { id: 'certificates', label: 'Certificates', icon: 'verified_user'  },
  { id: 'memberships',  label: 'Memberships',  icon: 'groups'         },
  { id: 'approval',     label: 'Approval',     icon: 'rule'           },
] as const;

export function Sidebar() {
  const user              = useAuthStore((s) => s.user);
  const { data: instances = [] } = useInstances();
  const activeInstanceId  = useCanvasStore((s) => s.activeInstanceId);
  const setActiveInstance = useCanvasStore((s) => s.setActiveInstance);
  const [activeNav, setActiveNav] = useState<string>('organization');
  const [showCreate, setShowCreate] = useState(false);

  const initials = (user?.email || 'KY').slice(0, 2).toUpperCase();

  function scrollTo(id: string) {
    setActiveNav(id);
    document.getElementById(`card-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return (
    <aside className="w-[220px] h-screen fixed left-0 top-0 bg-white border-r border-slate-100 flex flex-col py-6 z-50">
      {/* Logo */}
      <div className="px-6 mb-8">
        <span className="text-xl font-bold text-indigo-700 tracking-tight">dsf.</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        <a
          href="#"
          className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors duration-200"
        >
          <span className="material-symbols-outlined text-[20px]">home</span>
          <span className="text-sm">My Instance</span>
        </a>

        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors duration-200 text-left ${
              activeNav === id
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {/* User Identity + Instance Settings */}
      <div className="px-3 mt-auto">
        <button onClick={() => setShowCreate(true)}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors mb-2 px-4">
          + New instance
        </button>
        <InstanceCreateModal open={showCreate} onClose={() => setShowCreate(false)} />
        {/* Instance-Switcher */}
        <div className="px-4 mb-2">
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

        {/* User Card */}
        <div className="p-4 bg-slate-50 rounded-xl mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.email}</p>
              <p className="text-[10px] text-slate-500 truncate mono-id">
                dsf-bpe.ukmuenster.de
              </p>
            </div>
          </div>
        </div>

        <a href="#" className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-sm">Instance Settings</span>
        </a>
      </div>
    </aside>
  );
}
