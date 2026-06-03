# Handoff

**Date:** 2026-06-03
**Scope:** roughly the last 200 commits (the bundle-conformance lead-in through commit ~708).

This stretch added **no new user-facing features**. Every change was quality,
robustness, documentation, test coverage, internationalization, or security
hardening. No new pages, no new endpoints, no UX flows added or removed, and no
schema-shape change beyond the additive `contacts.language` column that had
already shipped. The sections below summarize what changed and why.

## DSF FHIR bundle conformance

- Identifier systems moved to the DSF canonical `sid/*` URLs.
- Every emitted resource and the Bundle envelope now carry the DSF
  `read-access-tag` (`ALL`) and a `dsf.dev` `StructureDefinition` `meta.profile`,
  so receiving DSF FHIR servers route the bundle through the strict validator.
- `OrganizationAffiliation.code` emits one entry per stored membership role
  using the DSF role code system (role fidelity).
- The Endpoint resource shape is DSF-compliant (`status`, `connectionType`,
  `payloadType=Task`, `payloadMimeType`, name fallback).

## Notification correctness

- Structured pino logging replaced ad-hoc `console.*` across the cron, notify,
  auth, and audit services.
- Admin email links point at the real `/app/admin` route (a prior link targeted
  a non-existent path).
- Post-approval notification renders a structured DE/EN template (content hash,
  signature `kid`, change counts, download/verify links), with per-recipient
  send state so a partial failure does not re-notify already-served contacts.

## Simplification (behavior-preserving)

- `getErrorMessage` helper centralizes axios error extraction (replaced ~16
  inline copies).
- `useToastMutation` hook collapses the repeated mutate/toast/invalidate blocks
  on the admin pages.

## Documentation

- Regenerated `docs/wiki/API-Reference.md` from the real routes (55 endpoints).
- Rebuilt `docs/wiki/Architecture.md` with system, auth, and approval-bundle
  Mermaid diagrams plus the cron and Redis-key tables.
- Added 14 ADRs under `docs/adr/`, `CONTRIBUTING.md`, and the `docs/database/`
  set (schema, ERD, migration catalog, Redis-key registry, retention notes).
- Backfilled file-purpose headers across the frontend.

## Input validation

- Certificate PEM capped at 20 KB to keep oversized input from tying up the
  node-forge parser.
- Pure schema tests lock the organization, contact, endpoint, and certificate
  validation rules.

## Test coverage

- Added a `renderWithProviders` harness and component tests for the cards,
  modals, layout, map pieces, and pages; tests for every Zustand store and the
  key hooks.
- Added backend service tests (CRUD, cron sweeps, `diffVersions`, the Excel
  export) verified against the database inside the backend container.
- Added security regression tests: OTP single-use and TOTP anti-replay.

## Animation

- CSS-only micro-interactions (fade-in, scale-in, hover-lift, button press),
  all gated behind the existing `prefers-reduced-motion` block. No resting
  appearance changed, so the visual-regression snapshots stay stable.

## Internationalization

- Localized the command palette, onboarding wizard, undo toasts, entity cards,
  search, and remaining ARIA labels (DE/EN). English values are kept
  byte-identical so the English UI — and its snapshots — are unchanged.

## IT-security

- The refresh idle-check now fails soft when Redis is unreachable (distinguishes
  a missing activity key from Redis being down) to avoid logging every user out
  on a transient blip.
- Widened the logger redact paths to nested tokens, PEM bodies, and the
  client-cert header.
- Fixed a latent CI configuration bug: `TOTP_ENCRYPTION_KEY` was 16 bytes;
  AES-256-GCM needs 32.

## Pipeline hygiene

- The Docker build job now depends on all test jobs, so a red E2E run can no
  longer ship to `main`.
- Removed the dead Storybook / lost-pixel job (no stories on disk).
- Replaced char-by-char `userEvent.type` in two modal tests with atomic
  `fireEvent.change` to eliminate a CI typing-race flake.

## Not changed

No new product features, pages, or endpoints. The work here makes the existing
application more correct, better tested, better documented, and harder to break
— it does not change what the application does.
