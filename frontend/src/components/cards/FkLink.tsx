/**
 * FkLink.tsx – Clickable FK value that highlights the target card.
 */
import { useCanvasStore } from '../../stores/canvas.store';

interface FkLinkProps {
  label: string;
  targetEntity: 'organization' | 'contacts' | 'endpoints' | 'certificates' | 'memberships' | 'approval';
  value: string;
}

export function FkLink({ label, targetEntity, value }: FkLinkProps) {
  const highlightEntity = useCanvasStore((s) => s.highlightEntity);

  function handleClick() {
    highlightEntity(targetEntity);
    const el = document.getElementById(`card-${targetEntity}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', borderBottom: '1px solid #f0f2f8', fontSize: '12px',
    }}>
      <span style={{ color: '#9b9fad' }}>{label}</span>
      <span
        onClick={handleClick}
        style={{
          color: '#6c63ff', fontFamily: 'monospace', fontSize: '11px',
          cursor: 'pointer', textDecoration: 'underline',
        }}
      >
        {value}
      </span>
    </div>
  );
}
