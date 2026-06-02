# Database Documentation

Reference for the MySQL schema, generated from the migrations in
`db/migrations/`.

| Document | Contents |
|---|---|
| [`schema.md`](schema.md) | Per-table column reference (types, nullability, keys, foreign keys) for all tables. |
| [`erd.md`](erd.md) | Entity-relationship diagram (Mermaid) of the core entities. |
| [`migrations.md`](migrations.md) | Chronological catalog of every migration and its purpose. |
| [`redis-keys.md`](redis-keys.md) | Redis key-prefix registry with TTLs. |
| [`retention-and-immutability.md`](retention-and-immutability.md) | Audit append-only triggers, membership soft-delete retention, snapshot growth. |

The schema is applied by MySQL's docker entrypoint on first init only; to apply
a new migration to an existing dev database, run it explicitly (see
[`../DEPLOYMENT.md`](../DEPLOYMENT.md)).
