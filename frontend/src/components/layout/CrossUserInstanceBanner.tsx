/**
 * CrossUserInstanceBanner.tsx – Shown only when an IMI admin has loaded an
 * instance owned by a different user. Provides a clear visual cue so admin
 * edits don't accidentally mutate someone else's data.
 */
import { useMe } from '../../hooks/useMe';
import { useInstance } from '../../hooks/useInstance';

interface Props { instanceId: string | null }

export function CrossUserInstanceBanner({ instanceId }: Props) {
  const { data: me } = useMe();
  const { data: instance } = useInstance(instanceId);
  if (!me?.isAdmin || !instance || !instanceId) return null;
  const owner = instance.owner_email ?? null;
  if (!owner || owner === me.email) return null;
  return (
    <div
      role="alert"
      style={{
        margin: '8px 20px 0',
        padding: '10px 14px',
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#b45309', flexShrink: 0, marginTop: '1px' }}>
        admin_panel_settings
      </span>
      <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
        <p style={{ margin: 0, fontWeight: 700, color: '#92400e' }}>
          You are viewing another user's instance
        </p>
        <p style={{ margin: '2px 0 0', color: '#92400e' }}>
          This instance belongs to <span style={{ fontFamily: 'monospace' }}>{owner}</span>. Any change you save will be applied to their data.
        </p>
      </div>
    </div>
  );
}
