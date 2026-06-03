/**
 * ExpiryWarningBanner.tsx — banner warning of soon-expiring certificates for the active instance.
 * Queries getExpiringCerts; hidden when none expiring, highlights <30-day items in red.
 */
import { useQuery } from '@tanstack/react-query';
import { useCanvasStore } from '../../stores/canvas.store';
import { api } from '../../api/entities.api';
import { daysUntil } from '../../lib/dateUtils';
import { useI18n } from '../../stores/i18n.store';

export function ExpiryWarningBanner() {
  const { t } = useI18n();
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const { data: expiring = [] } = useQuery({
    queryKey: ['certs-expiring', activeInstanceId],
    queryFn: () =>
      api(activeInstanceId!)
        .getExpiringCerts()
        .then((r) => r.data.data as { id: string; subject: string; valid_until: string }[]),
    enabled: !!activeInstanceId,
    staleTime: 60_000,
  });

  if (expiring.length === 0) return null;

  return (
    <div
      className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3"
      style={{ margin: '8px 20px 0' }}
    >
      <span className="material-symbols-outlined text-amber-500 text-[20px] flex-shrink-0 mt-0.5">
        warning
      </span>
      <div className="flex-1">
        <p className="text-xs font-bold text-amber-800 mb-1">
          {expiring.length > 1
            ? t('expiryBannerTitlePlural', { n: expiring.length })
            : t('expiryBannerTitle', { n: expiring.length })}
        </p>
        <div className="space-y-0.5">
          {expiring.map((cert) => (
            <p key={cert.id} className="text-[10px] text-amber-700">
              <span className="font-mono">{cert.subject}</span>
              {' · '}
              <span className={daysUntil(cert.valid_until) < 30 ? 'text-red-600 font-bold' : ''}>
                {t('expiryDaysRemaining', { n: daysUntil(cert.valid_until) })}
              </span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
