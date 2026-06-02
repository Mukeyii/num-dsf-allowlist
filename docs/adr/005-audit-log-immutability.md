# ADR-005 — Append-only audit log enforced by DB triggers

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

The audit log is the portal's record of every auth event, mutation, and
approval. Its value depends on being tamper-evident: a privileged user — or a
bug in the writer code — must not be able to rewrite or erase history after the
fact. Until this decision, "no UPDATE / no DELETE on `audit_logs`" was only a
convention in the project guidelines, enforceable solely by hoping every code
path honoured it.

## Decision

Migration `013_audit_log_immutability.sql` turns the convention into a hard SQL
constraint with two triggers on `audit_logs`:

- `audit_logs_no_update` — `BEFORE UPDATE`, raises `SIGNAL SQLSTATE '45000'`
  with message "audit_logs is append-only; UPDATE is not permitted";
- `audit_logs_no_delete` — `BEFORE DELETE`, raises the same signal for DELETE.

Any UPDATE or DELETE against the table is rejected (MySQL error 1644) and the
transaction aborts. Inserts are unaffected, so the log remains append-only.
Audit writes themselves are non-blocking: a failed log write must not abort the
operation it describes.

## Consequences

Positive:

- Append-only semantics are enforced at the database layer, independent of
  application correctness, for any caller holding the app's DB role.
- Accidental writer regressions that attempt to mutate audit rows fail loudly
  rather than silently corrupting the record.

Negative:

- `BEFORE DELETE` triggers do not fire for `TRUNCATE`, and triggers can be
  dropped. The protection therefore assumes the application DB role does **not**
  hold `DROP`/`TRUNCATE` (or `SUPER`) privileges; granting those would let an
  attacker remove the triggers and then mutate the table. This privilege
  restriction must be enforced operationally at grant time.
- Legitimate corrections (e.g. data-retention erasure) cannot be done in place
  and require an out-of-band, privileged procedure.
