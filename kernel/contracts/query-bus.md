# Kernel Contract: Query Bus

## Purpose

Routes read requests to query handlers.

## Responsibility

The query bus coordinates read behavior without mutating state and without exposing private persistence models.

## Inputs

- Query name.
- Query payload.
- Actor/context.
- Correlation ID.

## Outputs

- Query result DTO.
- Not found, validation, or authorization errors.

## Pseudocode

```txt
interface QueryBus {
  ask(query): QueryResult
}

interface Query {
  name(): QueryName
  actor(): Actor
  correlationId(): CorrelationId
  payload(): object
}
```

## Rules

- Queries must not change state.
- Query results must be DTOs or public contracts.
- Authorization still applies to reads.
- Reporting reads should use projections/read models, not aggregate repositories.

## Common Adapters

- In-process query dispatcher.
- Read model adapter.
- GraphQL resolver adapter.
- HTTP-to-query adapter.

## Failure Modes

- No handler registered.
- Unauthorized read.
- Projection lag.
- Stale cache.
- Query leaks private entity shape.

## Verification Checklist

- [ ] Does the query have one owner module?
- [ ] Is the result a public DTO or contract?
- [ ] Is read authorization explicit?
- [ ] Are projection freshness expectations documented?
- [ ] Does the query avoid mutating state?
