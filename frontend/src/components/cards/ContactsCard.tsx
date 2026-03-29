import { useContacts, useDeleteContact } from '../../hooks/useContacts';
import { EntityCard }      from './EntityCard';
import { FkLink }          from './FkLink';
import { useOrganization } from '../../hooks/useOrganization';
import { useModals }       from '../../hooks/useModals';
import { parseJsonArray }  from '../../lib/parseJsonArray';
import { api } from '../../api/entities.api';
import { toast } from 'sonner';
import { useI18n } from '../../stores/i18n.store';
import { undoableDelete } from '../../lib/undoDelete';

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  MEDIC:     { bg: '#ede9ff', color: '#4a42cc' },
  DSF_ADMIN: { bg: '#e8f0ff', color: '#1d4ed8' },
  SECURITY:  { bg: '#f0fff8', color: '#059669' },
};

export function ContactsCard({ instanceId }: { instanceId: string }) {
  const { t } = useI18n();
  const { data: contacts = [], isLoading } = useContacts(instanceId);
  const { data: org } = useOrganization(instanceId);
  const deleteMut = useDeleteContact(instanceId);

  return (
    <EntityCard
      id="contacts"
      title={t('contacts')}
      borderColor="#9b59b6"
      icon="contact_phone"
      onAdd={() => useModals.getState().openModal('contact-add')}
    >
      {org && <FkLink label="Organization" targetEntity="organization" value={org.identifier} />}

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t('loading')}</div>}
        {contacts.map((c: any) => (
          <div
            key={c.id}
            style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '10px 12px',
              cursor: 'pointer', transition: 'border-color 0.15s',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#6c63ff44')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {c.name || '—'}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {parseJsonArray(c.types).map((t: string) => (
                  <span key={t} style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                    background: TYPE_COLORS[t]?.bg || 'var(--bg-page)',
                    color:      TYPE_COLORS[t]?.color || 'var(--text-muted)',
                    fontWeight: 500,
                  }}>{t}</span>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: c.email_validated ? '#4caf8a' : '#f5a623' }}>
                {c.email_validated ? '✓ validated' : '⚠ not validated'}
              </div>
              {!c.email_validated && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await api(instanceId).resendVerification(c.id);
                      toast.success('Verification email sent.');
                    } catch { toast.error('Failed to send verification email.'); }
                  }}
                  className="text-[9px] text-primary underline hover:no-underline mt-0.5 block"
                >
                  Resend verification
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={(e) => { e.stopPropagation(); useModals.getState().openModal('contact-edit', c.id); }}
                title="Edit contact"
                style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ede9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6c63ff' }}>edit</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  undoableDelete(c.name || 'Contact', () => deleteMut.mutateAsync(c.id));
                }}
                title="Delete contact"
                style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>delete</span>
              </button>
            </div>
          </div>
        ))}
        {!isLoading && contacts.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
            {t('noData')}
          </div>
        )}
      </div>
    </EntityCard>
  );
}
