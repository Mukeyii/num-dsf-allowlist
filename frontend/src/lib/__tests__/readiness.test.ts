import { describe, it, expect } from 'vitest';
import { deriveReadiness } from '../readiness';
const future = '2999-01-01';
const past = '2000-01-01';
describe('deriveReadiness', () => {
  it('is ready only when all five conditions hold', () => {
    const r = deriveReadiness({
      organization: { active: true },
      contacts: [{}],
      endpoints: [{}],
      certificates: [{ valid_until: future }],
      memberships: [{}],
    });
    expect(r.ready).toBe(true);
    expect(r.openCount).toBe(0);
    expect(r.items.every((i) => i.done)).toBe(true);
  });
  it('an inactive org is not ready', () => {
    const r = deriveReadiness({
      organization: { active: false },
      contacts: [{}],
      endpoints: [{}],
      certificates: [{ valid_until: future }],
      memberships: [{}],
    });
    expect(r.ready).toBe(false);
    expect(r.items.find((i) => i.key === 'organization')!.done).toBe(false);
  });
  it('an expired-only certificate does not count', () => {
    const r = deriveReadiness({
      organization: { active: true },
      contacts: [{}],
      endpoints: [{}],
      certificates: [{ valid_until: past }],
      memberships: [{}],
    });
    expect(r.items.find((i) => i.key === 'certificates')!.done).toBe(false);
  });
  it('empty input is not ready and reports five open items', () => {
    const r = deriveReadiness({});
    expect(r.ready).toBe(false);
    expect(r.openCount).toBe(5);
  });
});
