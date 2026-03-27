import { useContacts }     from '../../hooks/useContacts';
import { EntityCard }      from './EntityCard';
import { FkLink }          from './FkLink';
import { useOrganization } from '../../hooks/useOrganization';
import { useModals }       from '../../hooks/useModals';

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  MEDIC:     { bg: '#ede9ff', color: '#4a42cc' },
  DSF_ADMIN: { bg: '#e8f0ff', color: '#1d4ed8' },
  SECURITY:  { bg: '#f0fff8', color: '#059669' },
};

export function ContactsCard({ instanceId }: { instanceId: string }) {
  const { data: contacts = [], isLoading } = useContacts(instanceId);
  const { data: org } = useOrganization(instanceId);

  return (
    <EntityCard
      id="contacts"
      title="Contacts"
      borderColor="#9b59b6"
      icon="contact_phone"
      onAdd={() => useModals.getState().openModal('contact-add')}
    >
      {org && <FkLink label="Organization" targetEntity="organization" value={org.identifier} />}

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isLoading && <div style={{ color: '#9b9fad', fontSize: '12px' }}>Loading…</div>}
        {contacts.map((c: any) => (
          <div
            key={c.id}
            style={{
              background: '#f8f9fc', border: '1px solid #e8eaf0',
              borderRadius: '10px', padding: '10px 12px',
              cursor: 'pointer', transition: 'border-color 0.15s',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#6c63ff44')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8eaf0')}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: '#ede9ff', color: '#6c63ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600,
            }}>
              {(c.name || c.email)?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a2e', marginBottom: '4px' }}>
                {c.name || '—'}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {JSON.parse(c.types || '[]').map((t: string) => (
                  <span key={t} style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                    background: TYPE_COLORS[t]?.bg || '#f0f2f8',
                    color:      TYPE_COLORS[t]?.color || '#9b9fad',
                    fontWeight: 500,
                  }}>{t}</span>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: c.email_validated ? '#4caf8a' : '#f5a623' }}>
                {c.email_validated ? '✓ validated' : '⚠ not validated'}
              </div>
            </div>
          </div>
        ))}
        {!isLoading && contacts.length === 0 && (
          <div style={{ color: '#9b9fad', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
            No contacts yet.
          </div>
        )}
      </div>
    </EntityCard>
  );
}
