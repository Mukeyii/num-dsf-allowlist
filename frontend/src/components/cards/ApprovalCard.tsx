import { useApprovalStatus, useApprovalHistory } from '../../hooks/useApproval';
import { EntityCard } from './EntityCard';
import { useModals } from '../../hooks/useModals';
import { useInstances } from '../../hooks/useInstance';
import { useCanvasStore } from '../../stores/canvas.store';

export function ApprovalCard({ instanceId }: { instanceId: string }) {
  const { data: status }       = useApprovalStatus(instanceId);
  const { data: history = [] } = useApprovalHistory(instanceId);
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const { data: instances = [] } = useInstances();
  const currentInstance = instances.find((i: any) => i.id === activeInstanceId);

  return (
    <EntityCard
      id="approval"
      title="Approval Summary"
      borderColor="#e05c5c"
      icon="rule"
      onAdd={() => useModals.getState().openModal('approval')}
      addLabel="Submit"
    >
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{currentInstance?.label || 'Instance'}</span>
          {status?.status === 'PENDING' && (
            <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
              1 Pending
            </span>
          )}
          {status?.status === 'APPROVED' && (
            <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
              Approved
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
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>History</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.slice(0, 5).map((req: any, i: number) => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: req.status === 'APPROVED' ? '#22c55e' : req.status === 'PENDING' ? '#f59e0b' : '#ef4444',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', fontWeight: 700 }}>Request #{history.length - i}</p>
                <p style={{ fontSize: '10px', color: '#64748b' }}>
                  {Math.floor((Date.now() - new Date(req.submitted_at || req.created_at).getTime()) / 86400000)}d ago
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
            <p style={{ color: '#9b9fad', fontSize: '12px' }}>No history yet.</p>
          )}
        </div>
      </div>
    </EntityCard>
  );
}
