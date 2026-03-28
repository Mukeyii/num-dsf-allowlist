// OrganizationCard – displays org summary with inline-editable name & email
// Dependencies: useOrganization, useContacts, useApprovalStatus, EntityCard, useModals

import { useState, useRef, useEffect } from 'react';
import { useOrganization, useUpdateOrganization } from '../../hooks/useOrganization';
import { useContacts }       from '../../hooks/useContacts';
import { useApprovalStatus } from '../../hooks/useApproval';
import { EntityCard }        from './EntityCard';
import { useModals }         from '../../hooks/useModals';
import { toast }             from 'sonner';

interface Props {
  instanceId: string;
}

export function OrganizationCard({ instanceId }: Props) {
  const { data: org, isLoading }   = useOrganization(instanceId);
  const { data: contacts = [] }    = useContacts(instanceId);
  const { data: approval }         = useApprovalStatus(instanceId);

  const updateMut = useUpdateOrganization(instanceId);
  const [editing, setEditing]     = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  async function saveInline(field: string) {
    if (!org || !editValue.trim()) { setEditing(null); return; }
    try {
      await updateMut.mutateAsync({
        identifier: org.identifier,
        name:  field === 'name'  ? editValue : org.name,
        email: field === 'email' ? editValue : org.email,
        active: org.active,
      });
      toast.success('Updated.');
    } catch {
      toast.error('Failed to update.');
    }
    setEditing(null);
  }

  const approvalStatus = (approval?.status ?? 'none') as 'APPROVED' | 'PENDING' | 'REJECTED' | 'none';
  const statusMap = {
    APPROVED: { bg: '#e8f5ee', color: '#2d7a57', label: 'approved' },
    PENDING:  { bg: '#fff8e8', color: '#854f0b', label: 'pending'  },
    REJECTED: { bg: '#fff0f0', color: '#9b2335', label: 'rejected' },
    none:     { bg: 'var(--bg-page)', color: 'var(--text-muted)', label: 'no request' },
  };
  const statusPill = statusMap[approvalStatus] ?? { bg: 'var(--bg-page)', color: 'var(--text-muted)', label: 'draft' };

  if (isLoading) return (
    <EntityCard id="organization" title="Organization" borderColor="#4d41df" icon="corporate_fare">
      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Loading…</div>
    </EntityCard>
  );

  if (!org) return (
    <EntityCard id="organization" title="Organization" borderColor="#4d41df" icon="corporate_fare"
      onAdd={() => useModals.getState().openModal('org-edit')} addLabel="Set up">
      <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
        No organization yet.<br />Click "Set up" to begin.
      </div>
    </EntityCard>
  );

  // Shared row style
  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '4px 0', borderBottom: '1px solid var(--bg-page)', fontSize: '12px',
  };

  return (
    <EntityCard
      id="organization"
      title="Organization"
      borderColor="#4d41df"
      icon="corporate_fare"
      addLabel="Edit"
      onAdd={() => useModals.getState().openModal('org-edit')}
    >
      {contacts.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Shared with
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {contacts.slice(0, 5).map((c: any) => (
              <div key={c.id} style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#ede9ff', color: '#6c63ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 600,
              }} title={c.name || c.email}>
                {(c.name || c.email)?.[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Static fields: Identifier, City, Address */}
      {[
        { label: 'Identifier', value: org.identifier, mono: true },
        { label: 'City',       value: `${org.city || '—'} · ${org.country_code || '—'}` },
        { label: 'Address',    value: org.address_line || '—' },
      ].map(({ label, value, mono }) => (
        <div key={label} style={rowStyle}>
          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span style={{
            color: mono ? '#6c63ff' : 'var(--text-primary)',
            fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
            fontSize: mono ? '11px' : '12px',
          }}>
            {value}
          </span>
        </div>
      ))}

      {/* Inline-editable: Name */}
      <div style={rowStyle}>
        <span style={{ color: 'var(--text-muted)' }}>Name</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, marginLeft: '8px' }}>
          {editing === 'name' ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => saveInline('name')}
              onKeyDown={e => {
                if (e.key === 'Enter')  saveInline('name');
                if (e.key === 'Escape') setEditing(null);
              }}
              style={{
                fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)',
                border: 'none', borderBottom: '2px solid #6c63ff',
                outline: 'none', background: 'transparent',
                width: '100%', padding: '2px 0', textAlign: 'right',
              }}
            />
          ) : (
            <span
              style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
              onDoubleClick={() => { setEditing('name'); setEditValue(org.name || ''); }}
              title="Double-click to edit"
            >
              {org.name}
            </span>
          )}
          {editing !== 'name' && (
            <span style={{ fontSize: '9px', color: '#d4d8e8', marginTop: '2px' }}>Double-click to edit</span>
          )}
        </div>
      </div>

      {/* Inline-editable: Email */}
      <div style={rowStyle}>
        <span style={{ color: 'var(--text-muted)' }}>Email</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, marginLeft: '8px' }}>
          {editing === 'email' ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => saveInline('email')}
              onKeyDown={e => {
                if (e.key === 'Enter')  saveInline('email');
                if (e.key === 'Escape') setEditing(null);
              }}
              style={{
                fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)',
                border: 'none', borderBottom: '2px solid #6c63ff',
                outline: 'none', background: 'transparent',
                width: '100%', padding: '2px 0', textAlign: 'right',
              }}
            />
          ) : (
            <span
              style={{ color: 'var(--text-primary)', cursor: 'pointer' }}
              onDoubleClick={() => { setEditing('email'); setEditValue(org.email || ''); }}
              title="Double-click to edit"
            >
              {org.email}
            </span>
          )}
          {editing !== 'email' && (
            <span style={{ fontSize: '9px', color: '#d4d8e8', marginTop: '2px' }}>Double-click to edit</span>
          )}
        </div>
      </div>

      {/* Active status pill */}
      <div style={rowStyle}>
        <span style={{ color: 'var(--text-muted)' }}>Status</span>
        <span style={{
          background: org.active ? '#e8f5ee' : '#fff0f0',
          color:      org.active ? '#2d7a57' : '#9b2335',
          padding: '1px 8px', borderRadius: '99px', fontSize: '11px',
        }}>
          {org.active ? 'active' : 'inactive'}
        </span>
      </div>

      {/* Approval status pill */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '10px', paddingTop: '8px',
        borderTop: '1px solid var(--bg-page)', fontSize: '12px',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>Approval</span>
        <span style={{
          background: statusPill.bg, color: statusPill.color,
          padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
        }}>
          {statusPill.label}
        </span>
      </div>
    </EntityCard>
  );
}
