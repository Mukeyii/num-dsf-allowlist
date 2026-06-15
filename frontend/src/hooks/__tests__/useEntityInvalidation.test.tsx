/**
 * useEntityInvalidation.test.tsx — locks in the canonical set of cross-cutting
 * cache keys invalidateAfterEntityMutation refreshes, so the coherence rule
 * shared by every entity mutation hook can't silently drift. Spies on the
 * QueryClient's invalidateQueries; no network or React rendering involved.
 */
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateAfterEntityMutation } from '../useEntityInvalidation';

describe('invalidateAfterEntityMutation', () => {
  it('invalidates the shared post-mutation caches for the instance', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    invalidateAfterEntityMutation(qc, 'inst-1');

    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual([
      ['approval-status', 'inst-1'],
      ['approval-history', 'inst-1'],
      ['activity-feed', 'inst-1'],
      ['audit'],
      ['network', 'map'],
    ]);
  });
});
