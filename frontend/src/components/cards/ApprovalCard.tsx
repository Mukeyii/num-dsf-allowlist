/**
 * ApprovalCard.tsx — entity card showing current approval status, progress bar, and recent history.
 * Reads useApproval/useInstance hooks; opens the approval submit modal via useModals.
 */
import { useApprovalStatus, useApprovalHistory } from '../../hooks/useApproval';
import { EntityCard } from './EntityCard';
import { useModals } from '../../hooks/useModals';
import { useInstances } from '../../hooks/useInstance';
import { useCanvasStore } from '../../stores/canvas.store';
import { useI18n } from '../../stores/i18n.store';

export function ApprovalCard({ instanceId }: { instanceId: string }) {
  const { t } = useI18n();
  const { data: status }       = useApprovalStatus(instanceId);
  const { data: history = [] } = useApprovalHistory(instanceId);
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const { data: instances = [] } = useInstances();
  const currentInstance = instances.find((i: any) => i.id === activeInstanceId);

  return (
    <EntityCard
      id="approval"
      title={t('approval')}
      borderColor="#e05c5c"
      icon="rule"
      onAdd={() => useModals.getState().openModal('approval')}
      addLabel={t('approvalCardSubmit')}
    >
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{currentInstance?.label || t('approvalCardInstanceFallback')}</span>
          {status?.status === 'PENDING' && (
            <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
              1 {t('pending')}
            </span>
          )}
          {status?.status === 'APPROVED' && (
            <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
              {t('approved')}
            </span>
          )}
        </div>
        <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            width: status?.status === 'APPROVED' ? '100%' : status?.status === 'PENDING' ? '15%' : '0%',
            height: '100%', borderRadius: '99px', background: '#e05c5c',
          }} />
        </div>
      </div>

      <div>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>{t('approvalHistory')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.slice(0, 5).map((req: any, i: number) => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: req.status === 'APPROVED' ? '#22c55e' : req.status === 'PENDING' ? '#f59e0b' : '#ef4444',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', fontWeight: 700 }}>{t('approvalCardRequestNum', { n: history.length - i })}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  {t('approvalCardDaysAgo', { n: Math.floor((Date.now() - new Date(req.submitted_at || req.created_at).getTime()) / 86400000) })}
                </p>
              </div>
              <span style={{
                fontSize: '10px', fontWeight: 700,
                color: req.status === 'APPROVED' ? '#16a34a' : req.status === 'PENDING' ? '#d97706' : '#dc2626',
              }}>
                {req.status}
              </span>
            </div>
          ))}
          {history.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t('noData')}</p>
          )}
        </div>
      </div>
    </EntityCard>
  );
}
