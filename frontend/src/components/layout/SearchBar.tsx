/**
 * SearchBar.tsx – Global search across all entities
 * Dependencies: useContacts, useEndpoints, useCertificates, useMemberships, useOrganization, canvas.store
 */
import { useState, useRef, useEffect } from 'react';
import { useContacts } from '../../hooks/useContacts';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useCertificates } from '../../hooks/useCertificates';
import { useMemberships } from '../../hooks/useMemberships';
import { useOrganization } from '../../hooks/useOrganization';
import { useCanvasStore } from '../../stores/canvas.store';
import { useI18n } from '../../stores/i18n.store';

interface SearchResult {
  type: 'organization' | 'contact' | 'endpoint' | 'certificate' | 'membership';
  label: string;
  detail: string;
  cardId: string;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  organization: { icon: 'corporate_fare', color: '#6c63ff' },
  contact: { icon: 'contact_phone', color: '#9b59b6' },
  endpoint: { icon: 'hub', color: '#3ecfb2' },
  certificate: { icon: 'verified_user', color: '#f5a623' },
  membership: { icon: 'groups', color: '#4a90d9' },
};

export function SearchBar() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const highlightEntity = useCanvasStore((s) => s.highlightEntity);

  const { data: org } = useOrganization(activeInstanceId);
  const { data: contacts = [] } = useContacts(activeInstanceId);
  const { data: endpoints = [] } = useEndpoints(activeInstanceId);
  const { data: certs = [] } = useCertificates(activeInstanceId);
  const { data: memberships = [] } = useMemberships(activeInstanceId);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl+K global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = ref.current?.querySelector('input');
        input?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  if (q.length >= 2) {
    if (org && (org.name?.toLowerCase().includes(q) || org.identifier?.toLowerCase().includes(q))) {
      results.push({ type: 'organization', label: org.name, detail: org.identifier, cardId: 'organization' });
    }
    (contacts as { name?: string; email?: string }[]).forEach((c) => {
      if (c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)) {
        results.push({ type: 'contact', label: c.name || c.email || '', detail: c.email || '', cardId: 'contacts' });
      }
    });
    (endpoints as { identifier?: string; name?: string; address?: string }[]).forEach((ep) => {
      if (ep.identifier?.toLowerCase().includes(q) || ep.name?.toLowerCase().includes(q) || ep.address?.toLowerCase().includes(q)) {
        results.push({ type: 'endpoint', label: ep.name || ep.identifier || '', detail: ep.address || '', cardId: 'endpoints' });
      }
    });
    (certs as { subject?: string; thumbprint?: string; valid_until?: string }[]).forEach((cert) => {
      if (cert.subject?.toLowerCase().includes(q) || cert.thumbprint?.toLowerCase().includes(q)) {
        results.push({ type: 'certificate', label: cert.subject || '', detail: `Valid until ${cert.valid_until}`, cardId: 'certificates' });
      }
    });
    (memberships as { parent_organization?: string }[]).forEach((ms) => {
      if (ms.parent_organization?.toLowerCase().includes(q)) {
        results.push({ type: 'membership', label: ms.parent_organization || '', detail: '', cardId: 'memberships' });
      }
    });
  }

  function handleSelect(r: SearchResult) {
    highlightEntity(r.cardId as Parameters<typeof highlightEntity>[0]);
    document.getElementById(`card-${r.cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', borderRadius: '10px',
        border: '1px solid var(--border)', background: 'var(--bg-hover)', width: '240px',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>search</span>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={`${t('searchEntities')} (Ctrl+K)`}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: '12px', color: 'var(--text-primary)', width: '100%',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>close</span>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100,
          maxHeight: '300px', overflowY: 'auto',
        }}>
          {results.slice(0, 10).map((r, i) => {
            const { icon, color } = TYPE_ICONS[r.type];
            return (
              <button
                key={`${r.type}-${i}`}
                onClick={() => handleSelect(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color }}>{icon}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.label}</p>
                  {r.detail && (
                    <p style={{
                      fontSize: '10px', color: 'var(--text-muted)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{r.detail}</p>
                  )}
                </div>
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)',
                  background: 'var(--bg-page)', borderRadius: '4px', padding: '2px 6px',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{r.type}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && q.length >= 2 && results.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100,
          padding: '16px 14px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No results for "{query}"</p>
        </div>
      )}
    </div>
  );
}
