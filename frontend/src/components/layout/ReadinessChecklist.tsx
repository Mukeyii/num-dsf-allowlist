/**
 * ReadinessChecklist.tsx – Right-panel submit-readiness checklist.
 * Reads the five entity hooks for the instance, derives per-step readiness via
 * deriveReadiness, and renders one row per step (✓ done / ⚠ open). Each open row
 * is a button that highlights and scrolls to the matching card. Purely
 * informational — it blocks nothing.
 * Depends on: the five entity hooks, deriveReadiness, canvas.store, i18n.store.
 */
import { useOrganization } from '../../hooks/useOrganization';
import { useContacts } from '../../hooks/useContacts';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useCertificates } from '../../hooks/useCertificates';
import { useMemberships } from '../../hooks/useMemberships';
import { deriveReadiness, type ReadinessKey } from '../../lib/readiness';
import { useCanvasStore } from '../../stores/canvas.store';
import { useI18n } from '../../stores/i18n.store';

const ITEM_LABEL_KEY: Record<
  ReadinessKey,
  | 'readinessOrganization'
  | 'readinessContacts'
  | 'readinessEndpoints'
  | 'readinessCertificates'
  | 'readinessMemberships'
> = {
  organization: 'readinessOrganization',
  contacts: 'readinessContacts',
  endpoints: 'readinessEndpoints',
  certificates: 'readinessCertificates',
  memberships: 'readinessMemberships',
};

function jumpToCard(key: ReadinessKey) {
  useCanvasStore.getState().highlightEntity(key);
  document.getElementById(`card-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function ReadinessChecklist({ instanceId }: { instanceId: string }) {
  const { t } = useI18n();
  const { data: organization } = useOrganization(instanceId);
  const { data: contacts = [] } = useContacts(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const { data: certificates = [] } = useCertificates(instanceId);
  const { data: memberships = [] } = useMemberships(instanceId);

  const { items, ready, openCount } = deriveReadiness({
    organization,
    contacts,
    endpoints,
    certificates,
    memberships,
  });

  return (
    <div className="space-y-2">
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--text-muted)' }}
      >
        {t('readinessTitle')}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const label = t(ITEM_LABEL_KEY[item.key]);
          const glyph = item.done ? '✓' : '⚠';
          const glyphColor = item.done ? '#22c55e' : '#f5a623';
          if (item.done) {
            return (
              <li
                key={item.key}
                className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs"
                style={{ color: 'var(--text-primary)' }}
              >
                <span aria-hidden="true" style={{ color: glyphColor }}>
                  {glyph}
                </span>
                <span>{label}</span>
              </li>
            );
          }
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => jumpToCard(item.key)}
                className="flex items-center gap-2 w-full px-2 py-1 rounded-lg text-xs text-left transition-colors"
                style={{ color: 'var(--text-primary)', background: 'var(--bg-hover)' }}
              >
                <span aria-hidden="true" style={{ color: glyphColor }}>
                  {glyph}
                </span>
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] font-bold" style={{ color: ready ? '#22c55e' : '#f5a623' }}>
        {ready ? t('readinessReady') : t('readinessOpen', { count: openCount })}
      </p>
    </div>
  );
}
