import { useOrganization }   from '../../hooks/useOrganization';
import { useContacts }       from '../../hooks/useContacts';
import { useApprovalStatus } from '../../hooks/useApproval';
import { EntityCard }        from './EntityCard';
import { useModals }         from '../../hooks/useModals';

interface Props {
  instanceId: string;
}

export function OrganizationCard({ instanceId }: Props) {
  const { data: org, isLoading }   = useOrganization(instanceId);
  const { data: contacts = [] }    = useContacts(instanceId);
  const { data: approval }         = useApprovalStatus(instanceId);

  const approvalStatus = approval?.status ?? 'none';
  const statusPill = {
    APPROVED: { bg: '#e8f5ee', color: '#2d7a57', label: 'approved' },
    PENDING:  { bg: '#fff8e8', color: '#854f0b', label: 'pending'  },
    REJECTED: { bg: '#fff0f0', color: '#9b2335', label: 'rejected' },
    none:     { bg: '#f0f2f8', color: '#9b9fad', label: 'no request' },
  }[approvalStatus] ?? { bg: '#f0f2f8', color: '#9b9fad', label: 'draft' };

  if (isLoading) return (
    <EntityCard id="organization" title="Organization" borderColor="#4d41df" icon="corporate_fare">
      <div style={{ color: '#9b9fad', fontSize: '12px' }}>Loading…</div>
    </EntityCard>
  );

  if (!org) return (
    <EntityCard id="organization" title="Organization" borderColor="#4d41df" icon="corporate_fare"
      onAdd={() => {}} addLabel="Set up">
      <div style={{ color: '#9b9fad', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
        No organization yet.<br />Click "Set up" to begin.
      </div>
    </EntityCard>
  );

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
          <div style={{ fontSize: '10px', color: '#9b9fad', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
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

      {[
        { label: 'Identifier', value: org.identifier, mono: true },
        { label: 'Name',       value: org.name },
        { label: 'Email',      value: org.email },
        { label: 'City',       value: `${org.city || '—'} · ${org.country_code || '—'}` },
        { label: 'Address',    value: org.address_line || '—' },
      ].map(({ label, value, mono }) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '4px 0', borderBottom: '1px solid #f0f2f8', fontSize: '12px',
        }}>
          <span style={{ color: '#9b9fad' }}>{label}</span>
          <span style={{
            color: mono ? '#6c63ff' : '#1a1a2e',
            fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
            fontSize: mono ? '11px' : '12px',
          }}>
            {value}
          </span>
        </div>
      ))}

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '4px 0', borderBottom: '1px solid #f0f2f8', fontSize: '12px',
      }}>
        <span style={{ color: '#9b9fad' }}>Status</span>
        <span style={{
          background: org.active ? '#e8f5ee' : '#fff0f0',
          color:      org.active ? '#2d7a57' : '#9b2335',
          padding: '1px 8px', borderRadius: '99px', fontSize: '11px',
        }}>
          {org.active ? 'active' : 'inactive'}
        </span>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '10px', paddingTop: '8px',
        borderTop: '1px solid #f0f2f8', fontSize: '12px',
      }}>
        <span style={{ color: '#9b9fad' }}>Approval</span>
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
