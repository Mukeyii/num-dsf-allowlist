# ADR-010 — Membership soft-delete with 90-day retention

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

When an admin removes a membership, peers must learn the affiliation is gone:
the bundle emits a `DELETE OrganizationAffiliation` so each DSF FHIR server
removes it from its local allow-list. If the row were hard-deleted immediately,
the generator would lose the information needed to emit that DELETE before every
site had consumed it, and the removal could fail to propagate. The row therefore
has to survive until propagation is reasonably assured, but not forever.

## Decision

Memberships are soft-deleted: a `deleted_at` timestamp marks removal rather than
deleting the row. `generateFullBundle` (`fhir.service.ts`) emits a
`DELETE OrganizationAffiliation` entry for each soft-deleted membership of an
approved org, while never emitting DELETE for Organization or Endpoint (those
may still be referenced by another tool's allow-list).

A daily cron, `runMembershipCleanup`
(`backend/src/services/membership-cleanup.service.ts`), hard-deletes rows whose
`deleted_at` is older than a retention window — default 90 days
(`MEMBERSHIP_SOFT_DELETE_RETENTION_DAYS`). By that point every participating site
has consumed at least one bundle carrying the DELETE entry, so the row's only
remaining job (signalling "removed") is done. The cleanup writes a single audit
entry listing the purged ids under `SYSTEM:membership-cleanup`.

## Consequences

Positive:

- The DELETE affiliation entry is reliably published to peers before the row is
  removed, keeping the federation in sync.
- Stale soft-deleted rows are reclaimed automatically after the retention
  window, bounding table growth.

Negative:

- The retention window is a fixed timer, not a confirmation that every peer
  actually fetched the bundle; a site offline for more than 90 days could miss
  the DELETE.
- Soft-deleted rows remain queryable until cleanup, so all read paths must
  filter on `deleted_at IS NULL` (as the generator and snapshot builder do).
