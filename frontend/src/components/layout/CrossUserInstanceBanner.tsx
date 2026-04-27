/**
 * CrossUserInstanceBanner.tsx – Shown only when an IMI admin has loaded an
 * instance owned by a different user. Provides a clear visual cue so admin
 * edits don't accidentally mutate someone else's data.
 */
import { useMe } from '../../hooks/useMe';
import { useInstance } from '../../hooks/useInstance';
import { useI18n } from '../../stores/i18n.store';

interface Props { instanceId: string | null }

export function CrossUserInstanceBanner({ instanceId }: Props) {
  const { t } = useI18n();
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
          {t('crossUserBannerTitle')}
        </p>
        <p style={{ margin: '2px 0 0', color: '#92400e' }}>
          {t('crossUserBannerBody', { owner })}
        </p>
      </div>
    </div>
  );
}
