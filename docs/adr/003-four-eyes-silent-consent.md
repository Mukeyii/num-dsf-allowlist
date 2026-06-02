# ADR-003 — Four-eyes approval with silent consent

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

Approving a site's instance publishes its organization, endpoints, and
certificate thumbprints into the federation-wide allow-list that downstream DSF
nodes trust. A single admin's mistake or compromised account should not be
enough to inject a participant. The process also has to keep moving when the
second reviewer is slow, without forcing approvals to block indefinitely.

## Decision

Approvals require two APPROVE signatures from admins at **different sites**,
where a site is the lowercased email domain (`siteOfEmail` in
`backend/src/lib/approvalState.ts`). Decisions are recorded as rows in
`approval_signatures`; the request stays `PENDING` until the rule is satisfied.

Status is derived by `deriveStatus`:

- any REJECT signature → `REJECTED`;
- two or more APPROVE signatures from distinct sites → `APPROVED`;
- exactly one APPROVE signature older than the silent-consent window, with no
  REJECT → `APPROVED` (silent consent / "Schweigen als Zustimmung").

`validateApproval` blocks a second approval from the same admin or the same
site. `approveRequest` re-derives status inside a row-locked transaction after
inserting each signature. The silent-consent window defaults to 7 days
(`APPROVAL_SILENT_CONSENT_DAYS`). A daily sweep,
`runSilentConsentSweep` in `approval-silent-consent.service.ts`, promotes any
request whose single APPROVE is older than the cutoff and has no REJECT,
attributing the action to `SYSTEM:silent-consent` in the audit log.

## Consequences

Positive:

- No single admin, and no single site, can unilaterally approve a participant.
- The silent-consent timeout prevents an unresponsive second reviewer from
  stalling onboarding forever.
- Every approval path (manual second signature or silent consent) writes an
  attributable audit entry.

Negative:

- Silent consent means an approval can go through with only one explicit human
  review if the second admin neither approves nor rejects within the window.
- Site identity is derived purely from the email domain, so two admins must use
  addresses on genuinely different domains for the four-eyes check to hold.
