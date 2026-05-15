import { useState, useEffect } from 'react';
import { useEndpoints, useDeleteEndpoint } from '../../hooks/useEndpoints';
import { useOrganization } from '../../hooks/useOrganization';
import { EntityCard }      from './EntityCard';
import { FkLink }          from './FkLink';
import { useModals }       from '../../hooks/useModals';
import { IpDiffBadge } from './IpDiffBadge';
import { useI18n } from '../../stores/i18n.store';
import { undoableDelete } from '../../lib/undoDelete';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';

function HealthDot({ url }: { url: string }) {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Try to fetch the FHIR endpoint — expect CORS to block, but if we get ANY response it's "up"
    fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
      .then(() => { if (!cancelled) setStatus('up'); })
      .catch(() => { if (!cancelled) setStatus('down'); });

    return () => { cancelled = true; controller.abort(); };
  }, [url]);

  const colors = { checking: '#d4d8e8', up: '#22c55e', down: '#ef4444' };
  const titles = { checking: 'Checking…', up: 'Reachable', down: 'Unreachable' };

  return (
    <span
      title={titles[status]}
      style={{
        display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
        background: colors[status], flexShrink: 0,
        boxShadow: status === 'up' ? '0 0 4px #22c55e44' : 'none',
      }}
    />
  );
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
      {org && <FkLink label="Organization" targetEntity="organization" value={org.identifier} />}

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t('loading')}</div>}
        {endpoints.map((ep: any) => (
          <div key={ep.identifier} style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '10px 12px',
            transition: 'border-color 0.15s',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#b01e6644')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <HealthDot url={ep.address} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {ep.name || ep.identifier}
                </span>
              </div>
              <div className="mono-id" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {ep.identifier}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ep.address}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(ep.ipAddresses || []).map((ip: any) => (
                  <span key={ip.id} style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                    background: 'var(--bg-page)', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: '3px',
                  }}>
                    {ip.ip}
                    {ip.isFhir && <span style={{ color: '#3ecfb2', fontWeight: 600 }}>F</span>}
                    {ip.isBpe  && <span style={{ color: '#4a90d9', fontWeight: 600 }}>B</span>}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={(e) => { e.stopPropagation(); useModals.getState().openModal('endpoint-edit', ep.identifier); }}
                title="Edit endpoint"
                aria-label="Edit endpoint"
                style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fde3ef')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#b01e66' }}>edit</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  undoableDelete(ep.name || ep.identifier, () => new Promise<void>((resolve, reject) => {
                    guard(async () => {
                      try { await deleteMut.mutateAsync(ep.identifier); resolve(); } catch (e) { reject(e); }
                    });
                  }));
                }}
                title="Delete endpoint"
                aria-label="Delete endpoint"
                style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>delete</span>
              </button>
            </div>
          </div>
        ))}
        {!isLoading && endpoints.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
            {t('noData')}
          </div>
        )}
      </div>
      <IpDiffBadge instanceId={instanceId} />
    </EntityCard>
  );
}
