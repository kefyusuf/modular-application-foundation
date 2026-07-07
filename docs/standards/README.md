# Standards

## Purpose

This directory defines the implementation-independent engineering standards for the foundation.

Use these documents when creating modules, contracts, examples, framework mappings, infrastructure adapters, or downstream implementation projects.

## Reading Path

Start with:

1. [`api.md`](./api.md) - API-first design and external interface rules.
2. [`events.md`](./events.md) - event naming, envelopes, outbox, inbox, retry, and replay.
3. [`security.md`](./security.md) - security baseline and abuse-case expectations.
4. [`auth-rbac.md`](./auth-rbac.md) - authentication, RBAC, and ABAC-ready policy guidance.
5. [`persistence.md`](./persistence.md) - PostgreSQL-first persistence and module-owned schemas.
6. [`architecture-tests.md`](./architecture-tests.md) - enforceable architecture fitness functions.

Then continue with the operational standards:

- [`idempotency.md`](./idempotency.md)
- [`concurrency.md`](./concurrency.md)
- [`observability.md`](./observability.md)
- [`testing.md`](./testing.md)
- [`ci-cd.md`](./ci-cd.md)

## Baseline Rules

- Standards must remain framework-neutral.
- Standards must explain verification, not only intent.
- Standards must not expose private module internals as public contracts.
- Standards must preserve contract-first, modular-monolith-first architecture.
- Standards must avoid runtime, cloud, or framework lock-in.

## Verification Checklist

- [ ] Does the change preserve module boundaries?
- [ ] Does the change keep public contracts versioned and stable?
- [ ] Does the change avoid framework-specific assumptions in the core?
- [ ] Does the change include security, observability, and test impact where relevant?
- [ ] Does the change keep examples consistent with the documented standards?
