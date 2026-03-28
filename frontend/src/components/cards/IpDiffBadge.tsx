/**
 * IpDiffBadge.tsx – Shows IP changes since last approved approval request
 * Dependencies: useApprovalHistory, useEndpoints
 */
import { useApprovalHistory } from '../../hooks/useApproval';
import { useEndpoints } from '../../hooks/useEndpoints';

interface Props {
  instanceId: string;
}

export function IpDiffBadge({ instanceId }: Props) {
  const { data: history = [] } = useApprovalHistory(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);

  // Find last APPROVED request
  const lastApproved = history.find((r: any) => r.status === 'APPROVED');
  if (!lastApproved) return null;

  // Get current IPs
  const currentIps = new Set<string>();
  endpoints.forEach((ep: any) => {
    (ep.ipAddresses || []).forEach((ip: any) => currentIps.add(ip.ip));
  });

  // Get previous IPs from snapshot
  const previousIps = new Set<string>();
  try {
    const snapshot = typeof lastApproved.snapshot_json === 'string'
      ? JSON.parse(lastApproved.snapshot_json)
      : lastApproved.snapshot_json;
    if (snapshot?.endpoints) {
      snapshot.endpoints.forEach((ep: any) => {
        (ep.ipAddresses || ep.ips || []).forEach((ip: any) => previousIps.add(ip.ip));
      });
    }
  } catch {
    return null;
  }

  const added = [...currentIps].filter(ip => !previousIps.has(ip));
  const removed = [...previousIps].filter(ip => !currentIps.has(ip));

  if (added.length === 0 && removed.length === 0) return null;

  return (
    <div style={{
      padding: '10px 14px', borderRadius: '10px', marginTop: '8px',
      border: '1px solid var(--border)', background: 'var(--bg-hover)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#f5a623' }}>difference</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>IP Changes since last approval</span>
      </div>
      {added.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
          {added.map(ip => (
            <span key={ip} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', fontFamily: 'monospace' }}>
              + {ip}
            </span>
          ))}
        </div>
      )}
      {removed.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {removed.map(ip => (
            <span key={ip} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: '#fef2f2', color: '#991b1b', fontFamily: 'monospace', textDecoration: 'line-through' }}>
              − {ip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
