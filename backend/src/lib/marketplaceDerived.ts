/**
 * marketplaceDerived.ts – Pure read-time derivations for marketplace trust
 * signals. License-compliance and staleness are never stored; they are
 * computed from the synced license/archived/last-commit fields on every read
 * so the badge can never drift from the underlying data.
 */

export const OSI_LICENSES = new Set<string>([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'GPL-2.0',
  'GPL-3.0',
  'LGPL-3.0',
  'MPL-2.0',
  'AGPL-3.0',
  'EPL-2.0',
  'ISC',
]);

export function isLicenseOsi(spdx: string | null): boolean {
  return !!spdx && OSI_LICENSES.has(spdx);
}

// A process is stale after a year without commits (or once the repo is archived).
export const STALE_MS = 365 * 24 * 60 * 60 * 1000;

export function isStale(archived: boolean, lastCommitAt: Date | string | null, now: Date): boolean {
  return (
    archived ||
    (lastCommitAt != null && now.getTime() - new Date(lastCommitAt).getTime() > STALE_MS)
  );
}
