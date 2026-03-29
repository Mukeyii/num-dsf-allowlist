# API Reference

## Authentication

All API endpoints (except `/fhir/*`) require a JWT Bearer token.

### Request OTP
```
POST /auth/request-otp
Body: { "email": "user@example.com" }
Response: { "data": { "message": "If this email is registered, a code has been sent." } }
```

### Verify OTP
```
POST /auth/verify-otp
Body: { "email": "user@example.com", "code": "123456" }
Response: { "data": { "tempToken": "..." } }
```

### Verify TOTP
```
POST /auth/verify-totp
Body: { "tempToken": "...", "code": "123456" }
Response: { "data": { "accessToken": "...", "user": { ... } } }
```

## Entity Endpoints

All entity endpoints are scoped to an instance: `/api/v1/instances/:instanceId/...`

### Organization
| Method | Path | Description |
|--------|------|-------------|
| GET | `/organization` | Get organization for instance |
| PUT | `/organization` | Create or update organization |

### Contacts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/contacts` | List contacts |
| POST | `/contacts` | Create contact |
| PUT | `/contacts/:id` | Update contact |
| DELETE | `/contacts/:id` | Delete contact |

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/endpoints` | List endpoints with IPs |
| POST | `/endpoints` | Create endpoint |
| PUT | `/endpoints/:id` | Update endpoint |
| DELETE | `/endpoints/:id` | Delete endpoint |

### Certificates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/certificates` | List certificates |
| POST | `/certificates` | Upload PEM certificate |
| DELETE | `/certificates/:id` | Delete certificate |

### Memberships
| Method | Path | Description |
|--------|------|-------------|
| GET | `/memberships` | List memberships |
| POST | `/memberships` | Create membership |
| PUT | `/memberships/:id` | Update membership |
| DELETE | `/memberships/:id` | Delete membership |

## Approval
| Method | Path | Description |
|--------|------|-------------|
| POST | `/approval/submit` | Submit for approval |
| GET | `/approval/status` | Get current status |
| GET | `/approval/history` | Get approval history |

## Admin (requires IMI_ADMIN_EMAILS)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/approval/admin/pending` | List pending requests |
| POST | `/admin/approval/admin/:id/approve` | Approve (requires TOTP) |
| POST | `/admin/approval/admin/:id/reject` | Reject (requires TOTP + comment) |

## FHIR (mTLS Client Certificate)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/fhir/Bundle/:endpointId` | Get DSF Allow List Bundle |
| GET | `/fhir/Bundle` | Search bundle by identifier |

## Downloads
| Method | Path | Description |
|--------|------|-------------|
| GET | `/download/bundle?endpointId=...` | Download FHIR Bundle (JSON) |
| GET | `/download/ip-address-list` | Download IP list (Excel) |
