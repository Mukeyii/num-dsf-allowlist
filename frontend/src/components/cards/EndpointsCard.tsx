/**
 * EndpointsCard.tsx — entity card listing FHIR endpoints with their IP addresses (FHIR/BPE flags).
 * Supports add/edit (useModals), undoable cross-user-guarded deletion, and an IP-diff badge.
 */
import { useEndpoints, useDeleteEndpoint } from '../../hooks/useEndpoints';
import { useOrganization } from '../../hooks/useOrganization';
import { EntityCard } from './EntityCard';
import { FkLink } from './FkLink';
import { useModals } from '../../hooks/useModals';
import { IpDiffBadge } from './IpDiffBadge';
import { useI18n } from '../../stores/i18n.store';
import { undoableDelete } from '../../lib/undoDelete';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';

interface EndpointIpRow {
  id: string;
  ip: string;
  isFhir?: boolean;
  isBpe?: boolean;
}

interface EndpointRow {
  identifier: string;
  name?: string;
  address: string;
  ipAddresses?: EndpointIpRow[];
}

export function EndpointsCard({ instanceId }: { instanceId: string }) {
  const { t } = useI18n();
  const { data: endpoints = [], isLoading } = useEndpoints(instanceId);
  const { data: org } = useOrganization(instanceId);
  const deleteMut = useDeleteEndpoint(instanceId);
  const guard = useCrossUserGuard();

  return (
    <EntityCard
      id="endpoints"
      title={t('endpoints')}
      borderColor="#3ecfb2"
      icon="hub"
      onAdd={() => useModals.getState().openModal('endpoint-add')}
    >
      {org && (
        <FkLink
          label={t('endpointCardFkOrganization')}
          targetEntity="organization"
          value={org.identifier}
        />
      )}

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isLoading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t('loading')}</div>
        )}
        {endpoints.map((ep: EndpointRow) => (
          <div
            key={ep.identifier}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 12px',
              transition: 'border-color 0.15s',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#b01e6644')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {ep.name || ep.identifier}
                </span>
              </div>
              <div
                className="mono-id"
                style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}
              >
                {ep.identifier}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ep.address}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(ep.ipAddresses || []).map((ip: EndpointIpRow) => (
                  <span
                    key={ip.id}
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '99px',
                      background: 'var(--bg-page)',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    {ip.ip}
                    {ip.isFhir && <span style={{ color: '#3ecfb2', fontWeight: 600 }}>F</span>}
                    {ip.isBpe && <span style={{ color: '#4a90d9', fontWeight: 600 }}>B</span>}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  useModals.getState().openModal('endpoint-edit', ep.identifier);
                }}
                title={t('endpointCardEditAria')}
                aria-label={t('endpointCardEditAria')}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fde3ef')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px', color: 'var(--primary)' }}
                >
                  edit
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  undoableDelete(
                    ep.name || ep.identifier,
                    () =>
                      new Promise<void>((resolve, reject) => {
                        guard(async () => {
                          try {
                            await deleteMut.mutateAsync(ep.identifier);
                            resolve();
                          } catch (e) {
                            reject(e);
                          }
                        });
                      }),
                  );
                }}
                title={t('endpointCardDeleteAria')}
                aria-label={t('endpointCardDeleteAria')}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px', color: '#ef4444' }}
                >
                  delete
                </span>
              </button>
            </div>
          </div>
        ))}
        {!isLoading && endpoints.length === 0 && (
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '12px',
              textAlign: 'center',
              padding: '12px 0',
            }}
          >
            {t('emptyEndpointsHint')}
          </div>
        )}
      </div>
      <IpDiffBadge instanceId={instanceId} />
    </EntityCard>
  );
}
