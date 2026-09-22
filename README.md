# Modular Application Foundation

> A framework-agnostic, educational reference repository for building contract-first, API-first, event-driven modular monolith applications.

This repository is not a framework starter kit. It is a **software architecture playbook** and **implementation blueprint** that teaches how to design production-grade modular applications without coupling the architecture to Laravel, Go, .NET, Node.js, Spring, Python, or any specific runtime.

## Purpose

Most teams either start with a framework folder structure and later discover that the application is tightly coupled, or they jump too early into microservices and inherit distributed-system complexity before they have stable domain boundaries.

This repository defines a third path:

```txt
Contract-first modular monolith
+ feature-sliced modules
+ DDD tactical patterns
+ hexagonal ports/adapters
+ event-driven integration
+ API-first interfaces
+ security and observability by default
```

## Target Audience

- Developers learning production-grade backend architecture.
- Senior engineers designing modular monoliths.
- Teams that want clean boundaries before considering microservices.
- Automation-assisted contributors that need precise repository constraints.
- Framework communities that want adaptable reference patterns.

## Core Principles

1. **Framework-agnostic core:** domain, application, contracts, and module rules are independent of any runtime.
2. **Modular monolith first:** one deployable system, strongly isolated modules.
3. **No hardcoded inter-module access:** modules communicate through public contracts, events, ports, projections, and policies.
4. **Contract-first APIs:** REST/OpenAPI, event/AsyncAPI, GraphQL, gRPC, and webhooks are modeled as external contracts.
5. **Security by design:** RBAC, ABAC-ready policies, CSRF rules, JWT safety, OWASP-aligned controls, audit logs, and rate limits are part of the foundation.
6. **Event-driven but not event-everything:** domain events, integration events, outbox/inbox, and optional event sourcing are separate concepts.
7. **Teach through realistic examples:** every concept must include when to use it, when not to use it, trade-offs, common mistakes, and examples.

## Recommended Reading Order

Start here if you want to learn or apply the architecture:

1. [`docs/architecture/overview.md`](./docs/architecture/overview.md) - architecture map.
2. [`docs/architecture/module-boundaries.md`](./docs/architecture/module-boundaries.md) - the most important rule set.
3. [`docs/architecture/modular-monolith.md`](./docs/architecture/modular-monolith.md) - default deployment and boundary model.
4. [`docs/architecture/hexagonal-ddd.md`](./docs/architecture/hexagonal-ddd.md) - domain, ports, adapters, and tactical DDD.
5. [`docs/standards/README.md`](./docs/standards/README.md) - standards index and reading path.
6. [`docs/standards/api.md`](./docs/standards/api.md) - API-first standard.
7. [`docs/standards/events.md`](./docs/standards/events.md) - event-driven standard.
8. [`docs/standards/security.md`](./docs/standards/security.md) - security baseline.
9. [`docs/standards/architecture-tests.md`](./docs/standards/architecture-tests.md) - architecture fitness functions.
10. [`examples/correct-vs-wrong/module-communication.md`](./examples/correct-vs-wrong/module-communication.md) - first practical boundary example.
11. [`templates/MODULE_MANIFEST.template.yml`](./templates/MODULE_MANIFEST.template.yml) - module manifest template.

## Documentation Map

Project documents:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`CHANGELOG.md`](./CHANGELOG.md)
- [`docs/releases/v0.1.0.md`](./docs/releases/v0.1.0.md)
- [`docs/releases/v0.2.0.md`](./docs/releases/v0.2.0.md)
- [`docs/references.md`](./docs/references.md)

Architecture:

- [`docs/architecture/overview.md`](./docs/architecture/overview.md)
- [`docs/architecture/modular-monolith.md`](./docs/architecture/modular-monolith.md)
- [`docs/architecture/module-boundaries.md`](./docs/architecture/module-boundaries.md)
- [`docs/architecture/feature-slice.md`](./docs/architecture/feature-slice.md)
- [`docs/architecture/hexagonal-ddd.md`](./docs/architecture/hexagonal-ddd.md)
- [`docs/architecture/event-driven.md`](./docs/architecture/event-driven.md)
- [`docs/architecture/event-sourcing.md`](./docs/architecture/event-sourcing.md)

Standards:

- [`docs/standards/README.md`](./docs/standards/README.md)
- [`docs/standards/api.md`](./docs/standards/api.md)
- [`docs/standards/events.md`](./docs/standards/events.md)
- [`docs/standards/security.md`](./docs/standards/security.md)
- [`docs/standards/auth-rbac.md`](./docs/standards/auth-rbac.md)
- [`docs/standards/persistence.md`](./docs/standards/persistence.md)
- [`docs/standards/idempotency.md`](./docs/standards/idempotency.md)
- [`docs/standards/concurrency.md`](./docs/standards/concurrency.md)
- [`docs/standards/observability.md`](./docs/standards/observability.md)
- [`docs/standards/testing.md`](./docs/standards/testing.md)
- [`docs/standards/ci-cd.md`](./docs/standards/ci-cd.md)
- [`docs/standards/architecture-tests.md`](./docs/standards/architecture-tests.md)

Architecture decisions:

- [`docs/adr/0001-use-contract-first-modular-monolith.md`](./docs/adr/0001-use-contract-first-modular-monolith.md)
- [`docs/adr/0002-use-openapi-asyncapi-cloudevents.md`](./docs/adr/0002-use-openapi-asyncapi-cloudevents.md)

Kernel contracts:

- [`kernel/contracts/module.md`](./kernel/contracts/module.md)
- [`kernel/contracts/container.md`](./kernel/contracts/container.md)
- [`kernel/contracts/command-bus.md`](./kernel/contracts/command-bus.md)
- [`kernel/contracts/query-bus.md`](./kernel/contracts/query-bus.md)
- [`kernel/contracts/event-bus.md`](./kernel/contracts/event-bus.md)
- [`kernel/contracts/event-store.md`](./kernel/contracts/event-store.md)
- [`kernel/contracts/unit-of-work.md`](./kernel/contracts/unit-of-work.md)
- [`kernel/contracts/specification.md`](./kernel/contracts/specification.md)
- [`kernel/contracts/policy-evaluator.md`](./kernel/contracts/policy-evaluator.md)
- [`kernel/contracts/transaction-manager.md`](./kernel/contracts/transaction-manager.md)
- [`kernel/contracts/idempotency-store.md`](./kernel/contracts/idempotency-store.md)
- [`kernel/contracts/lock-manager.md`](./kernel/contracts/lock-manager.md)
- [`kernel/contracts/repository.md`](./kernel/contracts/repository.md)
- [`kernel/contracts/cache-store.md`](./kernel/contracts/cache-store.md)
- [`kernel/contracts/queue.md`](./kernel/contracts/queue.md)
- [`kernel/contracts/file-storage.md`](./kernel/contracts/file-storage.md)
- [`kernel/contracts/secret-manager.md`](./kernel/contracts/secret-manager.md)
- [`kernel/contracts/observability.md`](./kernel/contracts/observability.md)

Reference modules:

- [`modules/identity/README.md`](./modules/identity/README.md)
- [`modules/access/README.md`](./modules/access/README.md)
- [`modules/audit/README.md`](./modules/audit/README.md)
- [`modules/notification/README.md`](./modules/notification/README.md)
- [`modules/settings/README.md`](./modules/settings/README.md)

Examples:

- [`examples/correct-vs-wrong/module-communication.md`](./examples/correct-vs-wrong/module-communication.md)
- [`examples/correct-vs-wrong/repository-pattern.md`](./examples/correct-vs-wrong/repository-pattern.md)
- [`examples/correct-vs-wrong/rbac-policy.md`](./examples/correct-vs-wrong/rbac-policy.md)
- [`examples/correct-vs-wrong/event-handling.md`](./examples/correct-vs-wrong/event-handling.md)
- [`examples/architecture-tests/pseudocode.md`](./examples/architecture-tests/pseudocode.md)
- [`examples/framework-mapping/laravel.md`](./examples/framework-mapping/laravel.md)
- [`examples/framework-mapping/go.md`](./examples/framework-mapping/go.md)
- [`examples/framework-mapping/dotnet.md`](./examples/framework-mapping/dotnet.md)
- [`examples/framework-mapping/node.md`](./examples/framework-mapping/node.md)

Runnable skeleton:

- [`starters/node-typescript/README.md`](./starters/node-typescript/README.md)

Infrastructure:

- [`infrastructure/README.md`](./infrastructure/README.md)
- [`infrastructure/ci/README.md`](./infrastructure/ci/README.md)
- [`infrastructure/docker/README.md`](./infrastructure/docker/README.md)
- [`infrastructure/monitoring/README.md`](./infrastructure/monitoring/README.md)
- [`infrastructure/gateway/README.md`](./infrastructure/gateway/README.md)
- [`infrastructure/cloud/README.md`](./infrastructure/cloud/README.md)

Templates:

- [`templates/ADR_TEMPLATE.md`](./templates/ADR_TEMPLATE.md)
- [`templates/FEATURE_DOC_TEMPLATE.md`](./templates/FEATURE_DOC_TEMPLATE.md)
- [`templates/MODULE_README_TEMPLATE.md`](./templates/MODULE_README_TEMPLATE.md)
- [`templates/PULL_REQUEST_TEMPLATE.md`](./templates/PULL_REQUEST_TEMPLATE.md)

## Repository Type

This repository is intentionally **documentation-first**.

It should evolve in this order:

```txt
1. Architecture standards
2. Contracts and templates
3. Pseudocode examples
4. Reference modules
5. Optional framework adapters
6. Optional runnable starter kits
```

Framework implementations should consume the standard, not define it.

## Proposed Repo Name

```txt
modular-application-foundation
```

Display title:

```txt
Modular Application Foundation
```

Tagline:

```txt
A practical architecture playbook for modular, API-first, event-driven applications.
```

## External Standards Baseline

This repository should align with these standards and specifications:

| Area | Standard |
|---|---|
| HTTP API contracts | OpenAPI Specification 3.2.0 |
| Message-driven contracts | AsyncAPI Specification 3.1.0 |
| Event envelope | CloudEvents 1.0 style event metadata |
| HTTP error format | RFC 9457 Problem Details |
| JWT safety | RFC 8725 JSON Web Token Best Current Practices |
| OAuth 2.0 safety | RFC 9700 OAuth 2.0 Security Best Current Practice |
| Application security verification | OWASP ASVS 5.0.0 |
| API security risks | OWASP API Security Top 10 2023 |
| Observability naming | OpenTelemetry Semantic Conventions |

See [`docs/references.md`](./docs/references.md).

## Non-Goals

This repository should not become:

- a microservice framework;
- a single-language framework clone;
- a heavy Kubernetes-first platform;
- a toy CRUD tutorial;
- a collection of vague architecture slogans;
- a repository full of empty TODO-only files;
- a generated starter that hides trade-offs.

## License

See [`LICENSE`](./LICENSE).
