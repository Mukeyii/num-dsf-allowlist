# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Entity-graph canvas with 6 interconnected entity cards
- Passwordless authentication (OTP + TOTP 2FA)
- Admin approval review with TOTP re-confirmation
- mTLS client certificate authentication for FHIR endpoints
- RS256 bundle signing with SHA-256 content hash audit
- Certificate renewal wizard
- Dark mode with blue-tinted palette
- DE/EN internationalization
- Global search (Ctrl+K)
- Command palette
- Notification center
- Onboarding wizard for new organizations
- Status dashboard for site admins
- Undo delete toast (10 seconds)
- Certificate expiry timeline
- IP whitelist diff view
- Health check indicators on endpoints
- DSF FHIR Web UI integration panel
- FHIR Bundle preview
- Drag-and-drop PEM certificate upload
- Pinned/favorite instances
- Breadcrumb navigation
- Activity feed with live audit log
- Validation checklist before approval submission
- Comprehensive API integration tests (Jest + supertest)
- Frontend unit tests (Vitest + MSW)
- GitHub Actions CI/CD pipeline
- GitHub Pages interactive demo
