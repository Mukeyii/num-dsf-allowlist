# ADR-007 — DSF read-access tag and meta.profile on every resource

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

The generated allow-list bundle is consumed by DSF FHIR servers across the
federation. A DSF FHIR server requires every emitted resource to declare its
read-access scope; without it the server treats the resource as LOCAL scope and
rejects the bundle. Receivers also need to know which structure definition to
validate each resource against — a generic FHIR validator is too lax for DSF's
constrained profiles, and prior non-canonical identifier systems caused silent
federation desync.

## Decision

`backend/src/services/fhir.service.ts` attaches a `meta` block to every emitted
resource and to the Bundle envelope:

- **read-access tag.** A `meta.tag` of system
  `http://dsf.dev/fhir/CodeSystem/read-access-tag`, code `ALL`
  (display "everybody"), meaning readable by every authenticated federation
  peer. `resourceMeta()` adds it to each resource; `BUNDLE_META` adds it to the
  Bundle.
- **meta.profile.** Each resource carries the matching DSF StructureDefinition
  URL — `…/organization`, `…/organization-parent`, `…/endpoint`,
  `…/organization-affiliation` — so the receiver selects the strict DSF
  validator.

Identifier and role code systems use the canonical `http://dsf.dev/...` URLs
rather than the generic HL7 ones, matching the reference allow-list tooling.

## Consequences

Positive:

- DSF FHIR servers accept the bundle instead of rejecting LOCAL-scoped
  resources, and validate against the correct strict profiles.
- Using canonical DSF systems keeps identifiers and role codes in sync with
  peer tooling, avoiding the silent desync seen with non-canonical paths.

Negative:

- The bundle is coupled to DSF's `dsf.dev` profile and code-system URLs; if the
  upstream DSF specification changes these, the generator must be updated in
  lockstep.
- Tagging every resource `ALL` is deliberate but means the bundle assumes its
  contents are network-public; contact PII is therefore excluded elsewhere
  (GDPR).
