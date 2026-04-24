/**
 * MapPage.tsx – Interactive P2P allow-list network map (all users)
 * Dependencies: useNetworkMap, NetworkGraph, NodeDetailsPanel, i18n.store
 */
import { useState } from 'react';
import { useNetworkMap } from '../hooks/useNetworkMap';
import { NetworkGraph } from '../components/map/NetworkGraph';
import { NodeDetailsPanel } from '../components/map/NodeDetailsPanel';
import { useI18n } from '../stores/i18n.store';

export function MapPage() {
  const { t } = useI18n();
  const { data: organizations = [], isLoading, error } = useNetworkMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = organizations.find(o => o.identifier === selectedId) || null;

  const counts = {
    valid:    organizations.filter(o => o.cert_status === 'VALID').length,
    expiring: organizations.filter(o => o.cert_status === 'EXPIRING').length,
    expired:  organizations.filter(o => o.cert_status === 'EXPIRED').length,
    none:     organizations.filter(o => o.cert_status === 'NONE').length,
  };

  return (
    <div style={{
      flex: 1, position: 'relative', display: 'flex', flexDirection: 'column',
      minHeight: 0, overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <header style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#b01e66' }}>hub</span>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t('networkMap')}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Active P2P nodes with valid certificates across the allow list
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <Legend color="#22c55e" label={`Valid ${counts.valid}`} />
            <Legend color="#f5a623" label={`Expiring ${counts.expiring}`} />
            <Legend color="#ef4444" label={`Expired ${counts.expired}`} />
            <Legend color="#94a3b8" label={`No cert ${counts.none}`} />
          </div>
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Loading network…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '14px' }}>
            Failed to load network map.
          </div>
        )}
        {!isLoading && !error && (
          <NetworkGraph
            organizations={organizations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
        <NodeDetailsPanel org={selected} onClose={() => setSelectedId(null)} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '20px',
      background: color + '22', color,
      fontSize: '11px', fontWeight: 600,
    }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
      {label}
    </div>
  );
}
