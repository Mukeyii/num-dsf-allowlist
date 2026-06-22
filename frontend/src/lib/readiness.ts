/** readiness.ts - pure submit-readiness derivation for the canvas checklist. */
import { daysUntil } from './dateUtils';

export type ReadinessKey =
  | 'organization'
  | 'contacts'
  | 'endpoints'
  | 'certificates'
  | 'memberships';
export interface ReadinessItem {
  key: ReadinessKey;
  done: boolean;
}
export interface Readiness {
  items: ReadinessItem[];
  ready: boolean;
  openCount: number;
}
interface ReadinessInput {
  organization?: { active?: boolean } | null;
  contacts?: unknown[];
  endpoints?: unknown[];
  certificates?: { valid_until?: string }[];
  memberships?: unknown[];
}
export function deriveReadiness(input: ReadinessInput): Readiness {
  const items: ReadinessItem[] = [
    { key: 'organization', done: !!input.organization && input.organization.active === true },
    { key: 'contacts', done: (input.contacts?.length ?? 0) > 0 },
    { key: 'endpoints', done: (input.endpoints?.length ?? 0) > 0 },
    {
      key: 'certificates',
      done: (input.certificates ?? []).some(
        (c) => !!c.valid_until && daysUntil(c.valid_until) >= 0,
      ),
    },
    { key: 'memberships', done: (input.memberships?.length ?? 0) > 0 },
  ];
  const openCount = items.filter((i) => !i.done).length;
  return { items, ready: openCount === 0, openCount };
}
