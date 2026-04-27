/**
 * VerbundPills.tsx – Toggleable pills for each parent_organization in
 * the visible org set. Multi-select. Clicking a pill highlights its
 * verbund: members get a halo (rendered in GeoMap), edges within the
 * verbund fade in (rendered in GeoMapEdges).
 */
import { verbundColor, verbundLabel } from '../../lib/peerEdges';

interface Props {
  counts: Map<string, number>;       // parent_organization -> visible member count
  active: Set<string>;                // parent_organizations toggled "on"
  onToggle: (parentOrg: string) => void;
}

export function VerbundPills({ counts, active, onToggle }: Props) {
  if (counts.size === 0) return null;
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {entries.map(([parent, n]) => {
        const on = active.has(parent);
        const color = verbundColor(parent);
        const label = verbundLabel(parent);
        return (
          <button
            key={parent}
            onClick={() => onToggle(parent)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '999px',
              border: `1px solid ${on ? color : 'var(--border)'}`,
              background: on ? `${color}38` : 'transparent',
              color: on ? color : 'var(--text-secondary)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            {label} ({n})
          </button>
        );
      })}
    </div>
  );
}
