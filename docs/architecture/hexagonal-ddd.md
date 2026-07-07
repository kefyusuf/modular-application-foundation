# Hexagonal DDD

## Purpose

Hexagonal architecture protects domain/application logic from external details. DDD provides the language and boundaries for business concepts.

## Layer Responsibilities

```txt
domain
  aggregates, entities, value objects, domain services, domain events

application
  use cases, commands, queries, ports, policies, transactions

infrastructure
  database, cache, queue, file storage, external APIs

interfaces
  REST, GraphQL, gRPC, CLI, jobs, webhooks
```

## Rules

- Domain does not know HTTP.
- Domain does not know database.
- Domain does not know queues.
- Application depends on ports, not concrete adapters.
- Infrastructure implements ports.
- Interfaces call application use cases.

## Repository Rule

Repository is for aggregate persistence, not every query.

Use projections/read models for reporting and list screens.

## Strategy Rule

Use strategy for interchangeable business algorithms or providers:

- payment provider;
- notification channel;
- storage backend;
- tenant resolution;
- tax calculation;
- pricing;
- retry/backoff.

## Verification Checklist

- [ ] Can domain tests run without database?
- [ ] Can application tests use fake ports?
- [ ] Are adapters replaceable?
- [ ] Are queries separated from aggregate repositories?
