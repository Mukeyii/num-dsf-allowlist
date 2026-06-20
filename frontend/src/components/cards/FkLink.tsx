/**
 * FkLink.tsx – Clickable FK value that highlights the target card.
 */
import { useCanvasStore } from '../../stores/canvas.store';

interface FkLinkProps {
  label: string;
  targetEntity:
    | 'organization'
    | 'contacts'
    | 'endpoints'
    | 'certificates'
    | 'memberships'
    | 'approval';
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid var(--bg-page)',
        fontSize: '12px',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        onClick={handleClick}
        style={{
          color: 'var(--primary)',
          fontFamily: 'monospace',
          fontSize: '11px',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        {value}
      </span>
    </div>
  );
}
