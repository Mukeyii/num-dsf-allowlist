/**
 * useEntityInvalidation.ts — single source of truth for the cross-cutting cache
 * keys every entity mutation must refresh, so the coherence rule can't drift per
 * hook. Callers still invalidate their OWN list key (['contacts', id], …); this
 * adds the shared keys on top.
 * Dependencies: @tanstack/react-query.
 */
import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate the caches that any create/update/delete on an instance's entities
 * can make stale: approval status/history, the activity feed and audit log that
 * record the change, and the cross-instance network map (re-published on
 * approval). ['audit'] is invalidated by prefix to cover the paginated
 * ['audit','cross-instance', page, limit] keys (v5 matches by prefix by default).
 */
export function invalidateAfterEntityMutation(qc: QueryClient, instanceId: string) {
  qc.invalidateQueries({ queryKey: ['approval-status', instanceId] });
  qc.invalidateQueries({ queryKey: ['approval-history', instanceId] });
  qc.invalidateQueries({ queryKey: ['activity-feed', instanceId] });
  qc.invalidateQueries({ queryKey: ['audit'] });
  qc.invalidateQueries({ queryKey: ['network', 'map'] });
}
