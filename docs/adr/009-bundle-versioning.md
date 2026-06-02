# ADR-009 — Signed, hashed bundle version snapshots

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

Every approval reshapes the federation-wide allow-list. Operators need to review
what each approval changed, diff against any prior state, re-download a known
bundle, and — in an emergency — restore a previous known-good state. The live
bundle is regenerated on demand from current data, so without persisted
snapshots there is no record of what the federation looked like at a given point
in time, and no tamper-evident artifact to compare against.

## Decision

Migration `017_bundle_versions.sql` adds a `bundle_versions` table with an
auto-incrementing `version_number`, the triggering context
(`triggered_by` ∈ APPROVAL/MANUAL/RESTORE, `approval_request_id`,
`triggered_by_email`), a `content_hash` (SHA-256 of the bundle), a `signature`
(RS256 JWT of the content hash), and the full `bundle_json` (LONGTEXT).

`approveRequest` calls `createSnapshot`
(`backend/src/services/bundle-versions.service.ts`) in a post-commit hook
whenever an approval transitions the world to APPROVED, **outside** the approval
transaction so `generateFullBundle` observes the freshly committed state; a
snapshot failure is logged but does not undo the approval. `signBundle`
(ADR-002) produces the RS256 signature and SHA-256 hash. `diffVersions` keys
entries by `resourceType/id` and returns added / removed / changed buckets for
the admin UI.

## Consequences

Positive:

- Each approval yields an immutable, signed, hash-verified record of the exact
  bundle published, enabling diff, re-download, and restore.
- The snapshot runs after commit, so it always reflects the committed approval
  state, and its failure cannot roll back an already-audited approval.

Negative:

- Every snapshot stores the full bundle JSON (~50 KB each), so storage grows
  with approval volume (estimated ~25 MB over 10 years of weekly approvals).
- The signature shares the JWT key pair, so its trust depends on that key's
  integrity (ADR-002).
