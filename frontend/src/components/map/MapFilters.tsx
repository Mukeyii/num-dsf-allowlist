/**
 * MapFilters.tsx – Search + active/inactive + cert-status filters for the network map
 * Dependencies: react, network.api types, i18n.store
 */
import type { MapOrganization } from '../../api/network.api';
import { useI18n } from '../../stores/i18n.store';

export interface MapFilterState {
  query: string;
  activeMode: 'all' | 'active' | 'inactive';
  certStatuses: Set<MapOrganization['cert_status']>;
}

interface Props {
  state: MapFilterState;
  onChange: (next: MapFilterState) => void;
  totalCount: number;
  visibleCount: number;
}

const STATUS_COLOR: Record<MapOrganization['cert_status'], string> = {
  VALID:    '#22c55e',
  EXPIRING: '#f5a623',
  EXPIRED:  '#ef4444',
  NONE:     '#94a3b8',
};

const STATUS_LABEL_KEY: Record<MapOrganization['cert_status'], 'mapStatusValid' | 'mapStatusExpiring' | 'mapStatusExpired' | 'mapStatusNone'> = {
  VALID:    'mapStatusValid',
  EXPIRING: 'mapStatusExpiring',
  EXPIRED:  'mapStatusExpired',
  NONE:     'mapStatusNone',
};

export function MapFilters({ state, onChange, totalCount, visibleCount }: Props) {
  const { t } = useI18n();
  function toggleStatus(s: MapOrganization['cert_status']) {
    const next = new Set(state.certStatuses);
    if (next.has(s)) next.delete(s); else next.add(s);
    onChange({ ...state, certStatuses: next });
  }

  const allStatuses: MapOrganization['cert_status'][] = ['VALID', 'EXPIRING', 'EXPIRED', 'NONE'];
  const modeLabelKey: Record<'all' | 'active' | 'inactive', 'mapFilterAll' | 'mapFilterActive' | 'mapFilterInactive'> = {
    all: 'mapFilterAll',
    active: 'mapFilterActive',
    inactive: 'mapFilterInactive',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 28px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)', flexWrap: 'wrap',
    }}>
      <div style={{ position: 'relative', flex: '0 0 280px' }}>
        <span className="material-symbols-outlined" style={{
          position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '18px', color: 'var(--text-muted)',
        }}>search</span>
        <input
          type="text"
          value={state.query}
          onChange={e => onChange({ ...state, query: e.target.value })}
          placeholder={t('mapFilterSearchPlaceholder')}
          style={{
            width: '100%', padding: '8px 10px 8px 36px',
            border: '1px solid var(--border)', borderRadius: '8px',
            fontSize: '12px', color: 'var(--text-primary)',
            background: 'var(--bg-page)', outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {(['all', 'active', 'inactive'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => onChange({ ...state, activeMode: mode })}
            style={{
              padding: '6px 12px', fontSize: '11px', fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: state.activeMode === mode ? '#b01e66' : 'var(--bg-card)',
              color: state.activeMode === mode ? '#fff' : 'var(--text-secondary)',
              textTransform: 'capitalize',
            }}
          >{t(modeLabelKey[mode])}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {allStatuses.map(s => {
          const on = state.certStatuses.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '999px',
                border: `1px solid ${on ? STATUS_COLOR[s] : 'var(--border)'}`,
                background: on ? STATUS_COLOR[s] + '22' : 'transparent',
                color: on ? STATUS_COLOR[s] : 'var(--text-secondary)',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR[s] }} />
              {t(STATUS_LABEL_KEY[s])}
            </button>
          );
        })}
      </div>

      <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
        {t('mapFilterShowingOf', { visible: visibleCount, total: totalCount })}
      </div>
    </div>
  );
}
