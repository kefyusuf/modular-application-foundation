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
- AI coding agents such as Codex that need precise implementation instructions.
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

1. [`PRD.md`](./PRD.md) - product requirements and scope.
2. [`REPO_STANDARD.md`](./REPO_STANDARD.md) - repository structure, naming, module, and documentation rules.
3. [`docs/architecture/overview.md`](./docs/architecture/overview.md) - architecture map.
4. [`docs/architecture/module-boundaries.md`](./docs/architecture/module-boundaries.md) - the most important rule set.
5. [`docs/standards/api.md`](./docs/standards/api.md) - API-first standard.
6. [`docs/standards/events.md`](./docs/standards/events.md) - event-driven standard.
7. [`docs/standards/security.md`](./docs/standards/security.md) - security baseline.
8. [`templates/MODULE_MANIFEST.template.yml`](./templates/MODULE_MANIFEST.template.yml) - module manifest template.

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
- an AI-generated starter that hides trade-offs.

## License

Recommended: MIT for code examples, CC BY 4.0 for written educational content.
