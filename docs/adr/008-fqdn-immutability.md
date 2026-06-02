# ADR-008 — Immutable organization and endpoint FQDN identifiers

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

`organizations.identifier` and `endpoints.identifier` are FQDNs that serve as
the cross-tool primary key in the federated DSF environment. Every other
AllowList tool's bundle references organizations and endpoints by these exact
values. If a site renames `dsf-fhir.example.de` to `dsf.example.de`, every peer
bundle still points at the old value and federation breaks. The identifier must
therefore be treated as immutable.

## Decision

Migration `015_endpoint_org_identifier_immutability.sql` adds two
`BEFORE UPDATE` triggers:

- `endpoints_identifier_immutable` — rejects any UPDATE where
  `NEW.identifier <> OLD.identifier` via `SIGNAL SQLSTATE '45000'`, with the
  message "endpoints.identifier is immutable; create a new endpoint and migrate
  memberships instead";
- `organizations_identifier_immutable` — the same for organizations.

The triggers enforce the rule at the database layer so that neither an
application bug nor a manual DBA `UPDATE` can desynchronise the federation.
Application-level guards exist for defence-in-depth, but the DB is the last line.

## Consequences

Positive:

- A federation-wide foreign key cannot be silently changed, even by direct SQL,
  keeping every peer's bundle references valid.
- The rejection message documents the supported alternative (create new, migrate
  memberships) at the point of failure.

Negative:

- A genuine rename requires creating a new organization or endpoint and
  migrating dependent memberships, rather than editing in place.
- Like all trigger-based guards, the protection assumes the app DB role cannot
  drop the triggers.
