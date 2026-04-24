/**
 * MapPage.tsx – Interactive P2P allow-list network map (role-aware)
 * Dependencies: useNetworkMap, NetworkGraph, NodeDetailsPanel, MapFilters, CertExpiryBanner, i18n.store
 */
import { useMemo, useState } from 'react';
import { useNetworkMap } from '../hooks/useNetworkMap';
import { NetworkGraph } from '../components/map/NetworkGraph';
import { NodeDetailsPanel } from '../components/map/NodeDetailsPanel';
import { MapFilters, MapFilterState } from '../components/map/MapFilters';
import { CertExpiryBanner } from '../components/map/CertExpiryBanner';
import { useI18n } from '../stores/i18n.store';

export function MapPage() {
  const { t } = useI18n();
  const { data, isLoading, error } = useNetworkMap();
  const organizations = data?.organizations ?? [];
  const isAdmin = !!data?.isAdmin;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [filter, setFilter] = useState<MapFilterState>({
    query: '',
    activeMode: 'all',
    certStatuses: new Set(['VALID', 'EXPIRING', 'EXPIRED', 'NONE']),
  });

  const filtered = useMemo(() => {
    const q = filter.query.trim().toLowerCase();
    return organizations.filter(o => {
      if (filter.activeMode === 'active' && !o.active) return false;
      if (filter.activeMode === 'inactive' && o.active) return false;
      if (!filter.certStatuses.has(o.cert_status)) return false;
      if (q && !(o.name.toLowerCase().includes(q) || o.identifier.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [organizations, filter]);

  const selected = filtered.find(o => o.identifier === selectedId)
    ?? organizations.find(o => o.identifier === selectedId)
    ?? null;

  const expiringCount = organizations.filter(o => o.cert_status === 'EXPIRING').length;
  const expiredCount  = organizations.filter(o => o.cert_status === 'EXPIRED').length;

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
              {isAdmin
                ? 'Admin view · full details for every approved node'
                : 'Active P2P nodes across the allow list'}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
            {isAdmin ? '🛡 Admin' : '👤 Member'}
          </div>
        </div>
      </header>

      <CertExpiryBanner expiringCount={expiringCount} expiredCount={expiredCount} />

      <MapFilters
        state={filter}
        onChange={setFilter}
        totalCount={organizations.length}
        visibleCount={filtered.length}
      />

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
            organizations={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
        <NodeDetailsPanel org={selected} isAdmin={isAdmin} onClose={() => setSelectedId(null)} />
      </div>
    </div>
  );
}
