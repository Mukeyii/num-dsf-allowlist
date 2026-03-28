/**
 * CommandPalette.tsx – Ctrl+K command palette for quick navigation
 * Dependencies: react-router-dom, useInstances, canvas.store, useModals
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstances } from '../../hooks/useInstance';
import { useCanvasStore } from '../../stores/canvas.store';
import { useModals } from '../../hooks/useModals';

interface Command {
  id: string;
  label: string;
  icon: string;
  color: string;
  category: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: instances = [] } = useInstances();
  const setActiveInstance = useCanvasStore((s) => s.setActiveInstance);

  // Toggle on Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const commands: Command[] = [
    // Navigation
    { id: 'nav-canvas', label: 'Go to Canvas', icon: 'dashboard', color: '#6c63ff', category: 'Navigation', action: () => { navigate('/app'); setOpen(false); } },
    { id: 'nav-admin', label: 'Approval Review', icon: 'admin_panel_settings', color: '#6c63ff', category: 'Navigation', action: () => { navigate('/app/admin'); setOpen(false); } },
    { id: 'nav-audit', label: 'Audit Log', icon: 'history', color: '#6c63ff', category: 'Navigation', action: () => { navigate('/app/audit'); setOpen(false); } },
    // Actions
    { id: 'act-org', label: 'Edit Organization', icon: 'corporate_fare', color: '#4d41df', category: 'Actions', action: () => { useModals.getState().openModal('org-edit'); setOpen(false); } },
    { id: 'act-contact', label: 'Add Contact', icon: 'contact_phone', color: '#9b59b6', category: 'Actions', action: () => { useModals.getState().openModal('contact-add'); setOpen(false); } },
    { id: 'act-endpoint', label: 'Add Endpoint', icon: 'hub', color: '#3ecfb2', category: 'Actions', action: () => { useModals.getState().openModal('endpoint-add'); setOpen(false); } },
    { id: 'act-cert', label: 'Add Certificate', icon: 'verified_user', color: '#f5a623', category: 'Actions', action: () => { useModals.getState().openModal('certificate-add'); setOpen(false); } },
    { id: 'act-membership', label: 'Add Membership', icon: 'groups', color: '#4a90d9', category: 'Actions', action: () => { useModals.getState().openModal('membership-add'); setOpen(false); } },
    { id: 'act-approval', label: 'Send for Approval', icon: 'rule', color: '#e05c5c', category: 'Actions', action: () => { useModals.getState().openModal('approval'); setOpen(false); } },
    { id: 'act-download', label: 'Download Allow List', icon: 'download', color: 'var(--text-secondary)', category: 'Actions', action: () => { useModals.getState().openModal('download'); setOpen(false); } },
    // Instances
    ...instances.map((inst: any) => ({
      id: `inst-${inst.id}`,
      label: `Switch to ${inst.label}`,
      icon: 'swap_horiz',
      color: '#3ecfb2',
      category: 'Instances',
      action: () => { setActiveInstance(inst.id); navigate('/app'); setOpen(false); },
    })),
  ];

  const q = query.toLowerCase().trim();
  const filtered = q ? commands.filter(c => c.label.toLowerCase().includes(q)) : commands;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIndex]) { filtered[selectedIndex].action(); }
  }

  if (!open) return null;

  // Group by category
  const groups: Record<string, Command[]> = {};
  filtered.forEach(c => { (groups[c.category] ??= []).push(c); });

  let flatIndex = 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />

      {/* Palette */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '480px', maxHeight: '400px',
          background: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)', border: '1px solid var(--border)',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)' }}>search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: 'var(--text-primary)', background: 'transparent' }}
          />
          <kbd style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '6px 0' }}>
          {Object.entries(groups).map(([category, cmds]) => (
            <div key={category}>
              <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 18px 4px' }}>{category}</p>
              {cmds.map(cmd => {
                const idx = flatIndex++;
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '8px 18px', border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: idx === selectedIndex ? 'var(--bg-page)' : 'transparent',
                      transition: 'background 0.05s',
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: cmd.color }}>{cmd.icon}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>No commands found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
