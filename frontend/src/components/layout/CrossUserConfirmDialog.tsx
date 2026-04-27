/**
 * CrossUserConfirmDialog.tsx – Confirmation modal shown when an admin attempts
 * to mutate data on an instance they don't own. Pure presentational.
 */
import { useI18n } from '../../stores/i18n.store';

interface Props {
  open: boolean;
  ownerEmail: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CrossUserConfirmDialog({ open, ownerEmail, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '440px', width: '90%',
          background: 'var(--bg-card)', borderRadius: '16px',
          padding: '24px', boxShadow: '0 24px 64px rgba(15,23,42,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#b45309' }}>warning</span>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('crossUserDialogTitle')}
          </h2>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {t('crossUserDialogBody', { owner: ownerEmail ?? t('crossUserDialogAnotherUser') })}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: '10px',
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t('crossUserCancelBtn')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px', borderRadius: '10px',
              border: 'none', background: '#b45309', color: '#fff',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t('crossUserContinueBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
