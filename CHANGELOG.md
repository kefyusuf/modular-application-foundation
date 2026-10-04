# Changelog

## Unreleased

### Added

- GitHub Actions verification for the Node/TypeScript reference implementation on Node 20/22, including architecture/HTTP/persistence tests, PostgreSQL worker checks, dependency audit, and retained review artifacts.
- Executing-query cancellation/termination tests on PostgreSQL, with server-side execution gating, original error codes, producer rollback, healthy-client reuse or replacement, and no callback replay.
- Checked-out transaction connection-loss coverage proving producer rollback, original error propagation, no callback replay, and later transaction recovery in the same worker.
- Real PostgreSQL idle-backend termination coverage proving the same Node worker can continue with a fresh connection and retained data.
- Real Node consumer process termination/recovery tests on PostgreSQL, preserving partial/full effects across lease reclamation without duplicate audit entries or queued notifications.
- Read-only PostgreSQL outbox delivery summaries and an explicit JSON status CLI, with pending-state partition, expiry boundaries, and read-only driver coverage.
- Disposable Docker PostgreSQL verification through the production driver, covering transaction isolation, refresh contention, concurrent cleanup, outbox claims, and stale lease acknowledgements.
- Loopback fixture target guards and bounded database lock/statement timeouts for the optional integration suite.
- Explicit expired-session maintenance in memory and PostgreSQL, with refresh-history deletion and a PostgreSQL CLI command.
- Cleanup tests for expiry boundaries, batch limits, retained replay protection, invalid parameters, transaction rollback, and missing database configuration.
- Isolated HTTP request/correlation context on identity events, persistent integration envelopes, and audit entries, with concurrency and retry/restart coverage.
- Versioned per-module SQL migration catalogs and history with source checksums, append-only applied versions, and transactional pending batches.
- Migration tests for persistent one-time execution, incompatible catalog rejection, rollback, and data-preserving adoption of earlier unversioned schemas.
- PostgreSQL audit entries and pending notification intents with module-owned schemas and atomic durable delivery receipts.
- Consumer recovery tests covering restart after completed/partial effects, failed writes without receipts, independent delivery IDs, and repeatable schema initialization.
- Optional PostgreSQL user/session persistence, normalized-email uniqueness, optimistic versions, and explicit identity schema initialization.
- Transactional identity outbox with integration envelopes, leased delivery, retries, and stable IDs for in-process consumer deduplication.
- Filesystem-backed PostgreSQL persistence tests covering restart recovery, producer rollback, replay revocation, delivery recovery, and HTTP behavior.
- Refresh/logout API operations, atomic in-memory refresh rotation, replay detection, and immediate session-wide token revocation.
- Configurable JWT key rings with active signing keys, retained verification keys, and production startup validation.
- Session lifecycle, concurrency, expiry, key-rotation, and configuration tests; audit records for logout/replay/missing-identity revocations.
- Standard `/api/v1/identity/auth/login` and bearer-protected `/api/v1/identity/me` operations with OpenAPI response envelopes and request/correlation metadata.
- Identity password/token ports with scrypt and jose JWT adapters, plus authentication and response-schema contract tests.
- HTTP integration tests using the real application wiring, covering registration, authorization, validation, login, lockout, health, and missing routes.
- TypeScript architecture checks for module privacy and layer direction, with allowed/forbidden dependency fixtures.

### Changed

- Update commit-pinned GitHub Actions to native Node 24 runtimes while preserving Node 20/22 reference verification.
- Reject PostgreSQL transactions when COMMIT reports ROLLBACK after a caught SQL error instead of returning an unpersisted success result.
- Return sanitized HTTP 500 problem responses for unexpected registration and legacy login failures instead of exposing infrastructure error messages as client errors.
- Upgrade the development test toolchain to patched Vitest 4 and Vite 6 releases while retaining Node 20 compatibility; ignore generated test reports.
- Handle checked-out PostgreSQL client errors throughout transaction ownership and discard failed connections instead of allowing an unhandled event to terminate the process.
- Handle idle PostgreSQL pool errors with a fixed diagnostic instead of allowing an unhandled error event to terminate the process.
- Persistent application startup now rejects incomplete identity or consumer schemas before accepting requests.
- Registration accepts a standard `password` alongside the separate legacy `passwordHash` mode; legacy login remains compatible for demo accounts and cannot authenticate standard password hashes.
- Documented standard login validation/lockout errors and password length limit in the foundation OpenAPI example.
- Extracted `createApplication()` so the entry point and integration tests use the same module composition with isolated in-memory state.
- Extended the skeleton typecheck to include test sources while keeping production builds free of tests.
- Updated the Node.js/TypeScript skeleton guide to reflect all five modules, identity/session feature slices, actual HTTP behavior, event subscribers, and current limitations.
- Documented differences between the runnable skeleton and the foundation API/event contracts, including demo authentication, login lockout, and transaction behavior.

## 0.3.0 - 2026-09-22

### Added

- Runnable Node.js/TypeScript skeleton (`starters/node-typescript`) with one register-user vertical slice, kernel ports, in-memory adapters, HTTP problem details, and unit tests.
- Skeleton modules for access (policy), audit, and notification (event subscribers on user registration).
- Skeleton settings module and identity login use case with lockout via `security.max_login_attempts`.

## 0.2.0 - 2026-09-22

### Added

- Kernel contracts for event store, unit of work, specification, cache store, queue, and secret manager, completing the FR-004 contract catalog.
- Node.js/TypeScript adapter blueprint with module layout, kernel ports, composition root, feature slice walkthrough, persistence and queue notes, and boundary enforcement guidance.
- Laravel adapter blueprint with module layout, kernel ports, service providers, feature slice walkthrough, persistence and queue notes, and boundary enforcement guidance.
- .NET adapter blueprint with solution layout, kernel ports, composition root, feature slice walkthrough, persistence and worker notes, and boundary enforcement guidance.
- Go adapter blueprint with package layout, kernel ports, composition root, feature slice walkthrough, persistence and worker notes, and boundary enforcement guidance.

## 0.1.0 - 2026-07-07

### Added

- Repository foundation, contributing guide, and license.
- Architecture documentation for modular monolith, module boundaries, feature slices, hexagonal DDD, event-driven integration, and event sourcing.
- Engineering standards for API design, events, security, auth/RBAC, persistence, idempotency, concurrency, observability, testing, CI/CD, and architecture fitness functions.
- Machine-readable contract examples for OpenAPI, AsyncAPI, JSON Schema, GraphQL, and protobuf.
- Reference module catalog for identity, access, audit, notification, and settings.
- Framework-neutral kernel contracts for module lifecycle, buses, container, policy evaluation, transactions, idempotency, locking, repositories, file storage, and observability.
- Correct-vs-wrong examples, architecture-test pseudocode, and framework mapping guides for Laravel, Go, .NET, and Node.js/TypeScript.
- Infrastructure guidance for Docker, CI, monitoring, gateway behavior, and cloud adapters.
- v0.1 release readiness notes.
- Standards directory index and reading path.

### Known Limitations

- The repository is documentation-first and does not include a runnable application.
- CI workflow files, package manifests, container manifests, and deployment automation are intentionally not included in v0.1.
- Framework-specific starter kits are future optional adapter work, not part of the foundation release.
