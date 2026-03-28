/**
 * ExpiryTimeline.tsx – Visual timeline of certificate expiry dates
 * Depends on: useCertificates hook, dateUtils
 */
import { useCertificates } from '../../hooks/useCertificates';
import { daysUntil } from '../../lib/dateUtils';

interface Props {
  instanceId: string | null;
}

export function ExpiryTimeline({ instanceId }: Props) {
  const { data: certs = [] } = useCertificates(instanceId);

  if (certs.length === 0) return null;

  const sorted = [...certs].sort((a: any, b: any) =>
    new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime()
  );

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#f5a623' }}>event</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Certificate Timeline
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative', paddingLeft: '12px' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: '5px', top: '4px', bottom: '4px',
          width: '2px', background: 'var(--border)', borderRadius: '1px',
        }} />

        {sorted.map((cert: any) => {
          const days = daysUntil(cert.valid_until);
          const color = days < 30 ? '#ef4444' : days < 90 ? '#f5a623' : '#22c55e';
          const dateStr = new Date(cert.valid_until).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

          return (
            <div key={cert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '6px 0', position: 'relative' }}>
              {/* Dot on the timeline */}
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                background: color, border: '2px solid var(--bg-card)',
                marginTop: '2px', marginLeft: '-6px', position: 'relative', zIndex: 1,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cert.subject}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{dateStr}</span>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                    background: `${color}18`, color,
                  }}>
                    {days < 0 ? 'EXPIRED' : `${days}d`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
