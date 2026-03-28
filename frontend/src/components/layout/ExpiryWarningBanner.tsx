import { useQuery } from '@tanstack/react-query';
import { useCanvasStore } from '../../stores/canvas.store';
import { api } from '../../api/entities.api';
import { daysUntil } from '../../lib/dateUtils';

export function ExpiryWarningBanner() {
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const { data: expiring = [] } = useQuery({
    queryKey: ['certs-expiring', activeInstanceId],
    queryFn: () => api(activeInstanceId!).getExpiringCerts().then(r => r.data.data as { id: string; subject: string; valid_until: string }[]),
    enabled: !!activeInstanceId,
    staleTime: 60_000,
  });

  if (expiring.length === 0) return null;

  return (
    <div className="mx-8 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
      <span className="material-symbols-outlined text-amber-500 text-[20px] flex-shrink-0 mt-0.5">warning</span>
      <div className="flex-1">
        <p className="text-xs font-bold text-amber-800 mb-1">
          {expiring.length} certificate{expiring.length > 1 ? 's' : ''} expiring soon
        </p>
        <div className="space-y-0.5">
          {expiring.map(cert => (
            <p key={cert.id} className="text-[10px] text-amber-700">
              <span className="font-mono">{cert.subject}</span>{' · '}
              <span className={daysUntil(cert.valid_until) < 30 ? 'text-red-600 font-bold' : ''}>
                {daysUntil(cert.valid_until)}d remaining
              </span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
