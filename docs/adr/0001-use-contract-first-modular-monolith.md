# ADR-0001: Use Contract-First Modular Monolith

## Status

Accepted

## Context

The foundation needs strong module boundaries without forcing microservice complexity at the beginning.

## Decision

Use a contract-first modular monolith as the default architecture.

## Consequences

### Positive

- Simpler deployment.
- Clear internal boundaries.
- Better testability.
- Future extraction remains possible.

### Negative

- Requires discipline and architecture tests.
- Bad boundaries can still create a big ball of mud.
- Teams must resist private cross-module imports.

## Alternatives Considered

- Microservices-first: rejected due to operational complexity.
- Framework MVC-first: rejected due to hidden coupling.

## Review Date

2026-10-01
