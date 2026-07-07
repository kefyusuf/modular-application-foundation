# Infrastructure Standards

## Purpose

Define infrastructure guidance for modular applications without making infrastructure the architecture.

Infrastructure is an adapter layer. It supports persistence, messaging, caching, file storage, observability, gateway behavior, and delivery pipelines. It must not define domain model shape, module boundaries, public contracts, or application use cases.

## Baseline Rules

- Infrastructure must stay behind ports and adapters.
- PostgreSQL is the default source of truth until a project explicitly chooses otherwise.
- Redis, queues, storage, search, analytics, and observability systems are adapters.
- Docker is useful for local parity and repeatable examples but is not a required architecture boundary.
- Kubernetes is an optional future deployment target, not the default design center.
- CI/CD must validate architecture, contracts, security, and docs before runtime promotion.
- Infrastructure choices must not bypass module manifests, public contracts, policy checks, or event versioning.

## Adapter Catalog

| Capability | Default Guidance | Notes |
|---|---|---|
| relational persistence | PostgreSQL | module-owned schemas and migrations |
| cache, lock, rate limit | Redis-compatible adapter | do not treat cache as source of truth |
| queue or broker | RabbitMQ, Kafka, SQS/SNS, EventBridge, or equivalent | use outbox and inbox rules |
| object storage | S3-compatible adapter such as MinIO or cloud storage | hide provider SDKs behind ports |
| observability | OpenTelemetry-compatible logs, metrics, and traces | preserve correlation context |
| gateway | reverse proxy or API gateway | enforce edge concerns, not business rules |
| CI/CD | GitHub Actions, GitLab CI, Jenkins, or equivalent | pipeline contract matters more than vendor |

## Guides

- [Docker Guidance](./docker/README.md)
- [Monitoring Guidance](./monitoring/README.md)
- [Gateway Guidance](./gateway/README.md)
- [Cloud Guidance](./cloud/README.md)
- [CI Guidance](./ci/README.md)

## Common Mistakes

- Letting provider SDKs leak into domain or application services.
- Treating Docker Compose as the architecture instead of a runtime convenience.
- Making Kubernetes manifests before module contracts are stable.
- Sharing one database schema without module ownership.
- Letting gateway rules replace application authorization.
- Adding observability only after incidents.
- Choosing infrastructure tools before defining the port contract they must satisfy.

## Verification Checklist

- [ ] Does every infrastructure dependency sit behind a port or adapter?
- [ ] Does each module still own its data and migrations?
- [ ] Are outbox, inbox, idempotency, and replay rules respected?
- [ ] Are secrets kept out of docs, logs, and commits?
- [ ] Can the system run without Kubernetes-specific assumptions?
- [ ] Can CI validate contracts, architecture rules, and security checks?
