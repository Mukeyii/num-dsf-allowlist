/**
 * AppPage.tsx – Main page: Sidebar + Canvas + RightPanel
 * Replaces the Phase 4 placeholder completely.
 */
import { useCanvasStore }  from '../stores/canvas.store';
import { useInstances }    from '../hooks/useInstance';
import { Sidebar }         from '../components/layout/Sidebar';
import { TopBar }          from '../components/layout/TopBar';
import { RightPanel }      from '../components/layout/RightPanel';
import { EntityCanvas }    from '../components/canvas/EntityCanvas';

export function AppPage() {
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  useInstances(); // Load instances + auto-select first

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: '#f0f2f8',
    }}>
      <Sidebar />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginLeft: '220px', marginRight: '280px',
      }}>
        <TopBar
          onDownload={() => {/* Phase 6 */}}
          onApproval={() => {/* Phase 6 */}}
        />
        {activeInstanceId ? (
          <EntityCanvas instanceId={activeInstanceId} />
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#9b9fad', fontSize: '14px',
          }}>
            Loading instance…
          </div>
        )}
      </div>

      <RightPanel instanceId={activeInstanceId} />
    </div>
  );
}
