# Changelog

## Unreleased

### Added

- Runnable Node.js/TypeScript skeleton (`starters/node-typescript`) with one register-user vertical slice, kernel ports, in-memory adapters, HTTP problem details, and unit tests.

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
