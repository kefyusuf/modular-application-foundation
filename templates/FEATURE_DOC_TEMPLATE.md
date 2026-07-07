# Feature: {feature-name}

## Purpose

Explain the user, operator, or system outcome this feature provides.

## Use Case

```txt
As a ...
I want ...
So that ...
```

## Module Ownership

```txt
Owning module:
Required capabilities:
Forbidden dependencies:
```

## Input Contract

Describe request DTO, command, query, event, or message input.

## Output Contract

Describe response DTO, result object, emitted event, or error contract.

## Authorization

Describe required actor, permission, scope, policy context, and object-level checks.

## Validation

Describe required fields, invariants, business rules, and error shape.

## Domain Behavior

Describe aggregates, value objects, domain services, and state transitions.

## Events Published

List integration events and whether outbox is required.

## Events Consumed

List subscribed events and whether inbox idempotency is required.

## Side Effects

Describe email, SMS, webhooks, file writes, external APIs, cache invalidation, and projections.

## Idempotency

Describe idempotency key, command ID, request hash, replay behavior, and expiry.

## Concurrency

Describe version checks, locks, ordering, duplicate delivery, and retry safety.

## Audit

Describe security events, admin actions, sensitive data access, and audit fields.

## Observability

Describe logs, metrics, traces, correlation IDs, and alerts.

## Tests

List unit, integration, contract, architecture, security, concurrency, replay, and E2E coverage.

## Common Mistakes

- Mistake 1.
- Mistake 2.

## Acceptance Criteria

- [ ] Input and output contracts are documented.
- [ ] Authorization and object-level access are explicit.
- [ ] Side effects are routed through ports, events, or adapters.
- [ ] Idempotency and concurrency behavior are defined.
- [ ] Events are versioned and outbox/inbox rules are clear.
- [ ] Tests cover behavior, boundaries, and failure cases.
