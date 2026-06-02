# Entity-Relationship Diagram

Core entities and their relationships. FKs use `ON DELETE CASCADE` unless noted.
`bundle_versions.approval_request_id` is `ON DELETE SET NULL`.

```mermaid
erDiagram
    USERS ||--o{ INSTANCES : owns
    INSTANCES ||--|| ORGANIZATIONS : "has (1:1, uq_org_instance)"
    INSTANCES ||--o{ APPROVAL_REQUESTS : raises
    ORGANIZATIONS ||--o{ CONTACTS : has
    ORGANIZATIONS ||--o{ ENDPOINTS : has
    ORGANIZATIONS ||--o{ CERTIFICATES : has
    ORGANIZATIONS ||--o{ MEMBERSHIPS : has
    ENDPOINTS ||--o{ ENDPOINT_IPS : has
    ENDPOINTS ||--o{ MEMBERSHIPS : "referenced by"
    APPROVAL_REQUESTS ||--o{ APPROVAL_SIGNATURES : "signed by"
    APPROVAL_REQUESTS ||--o{ BUNDLE_VERSIONS : "snapshotted as"

    USERS {
        char36 id PK
        varchar email UK
        tinyint totp_enabled
    }
    INSTANCES {
        char36 id PK
        char36 user_id FK
        varchar label
    }
    ORGANIZATIONS {
        varchar identifier PK "FQDN, immutable"
        char36 instance_id FK "UK"
        varchar name
        tinyint active
    }
    CONTACTS {
        char36 id PK
        varchar organization_id FK
        varchar email
        char2 language
    }
    ENDPOINTS {
        varchar identifier PK "FQDN, immutable"
        varchar organization_id FK
        varchar address
    }
    ENDPOINT_IPS {
        char36 id PK
        varchar endpoint_id FK
        varchar ip
    }
    CERTIFICATES {
        char36 id PK
        varchar organization_id FK
        varchar thumbprint
        date valid_until
    }
    MEMBERSHIPS {
        char36 id PK
        varchar organization_id FK
        varchar endpoint_id FK
        varchar parent_organization
        timestamp deleted_at "soft-delete"
    }
    APPROVAL_REQUESTS {
        char36 id PK
        char36 instance_id FK
        enum status
    }
    APPROVAL_SIGNATURES {
        char36 id PK
        char36 approval_request_id FK
        varchar admin_email
        enum decision
    }
    BUNDLE_VERSIONS {
        char36 id PK
        int version_number UK
        char36 approval_request_id FK "nullable"
        char64 content_hash
    }
    AUDIT_LOGS {
        char36 id PK
        char36 instance_id "no FK"
        enum resource_type
        enum operation
    }
    ADMIN_GRANTS {
        varchar email PK
        timestamp granted_at
    }
```

Notes:
- `audit_logs.instance_id` and `audit_logs.user_email` are indexed but not declared foreign keys, so they appear unconnected in the diagram.
- `admin_grants` has no foreign-key relationship to `users`; it is keyed by email.
