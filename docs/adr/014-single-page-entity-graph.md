# ADR-014 — Single-page entity canvas

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

The portal manages five interlinked entities per instance — Organization,
Contacts, Endpoints, Certificates, Memberships — connected by foreign keys.
A conventional tab- or page-per-entity UI hides those relationships and forces
constant navigation to understand or edit a connected record. The core UX
principle is that the whole entity graph for an instance is visible and editable
at once, with the relationships made tangible in the layout.

## Decision

All five entities render simultaneously on one canvas
(`frontend/src/components/canvas/EntityCanvas.tsx`) — no per-entity tabs or
pages. The canvas is a responsive multi-column grid (3 columns above ~1200px, 2
between ~800–1200px, 1 below), with each entity in its own card
(`OrganizationCard`, `ContactsCard`, `EndpointsCard`, `MembershipsCard`,
`CertificatesCard`). Foreign-key values are rendered as `FkLink`
(`frontend/src/components/cards/FkLink.tsx`): clicking one highlights the target
entity (via the canvas store) and scrolls its card into view, so relationships
are navigable in place rather than by changing page.

## Consequences

Positive:

- The complete instance graph and its foreign-key relationships are visible and
  editable on a single screen, removing tab/page switching.
- FK links make connections traversable in context by highlighting and scrolling
  to the related card.

Negative:

- Rendering all five entity cards at once is heavier per screen than a lazy
  per-tab view, and the layout must adapt across breakpoints.
- The single-canvas model is specific to the five-entity instance shape;
  scaling to many more entity types would strain the grid.
