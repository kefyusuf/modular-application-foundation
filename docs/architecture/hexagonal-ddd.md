# Hexagonal DDD

## Purpose

Hexagonal architecture protects domain/application logic from external details. DDD provides the language and boundaries for business concepts.

Together, they keep the business model independent from HTTP, queues, databases, cloud services, and framework runtime choices.

## When to Use

Use hexagonal DDD when:

- business rules are important enough to test without infrastructure;
- a module needs multiple adapters such as REST, jobs, CLI, queues, or webhooks;
- persistence, messaging, storage, or provider choices may change;
- domain concepts need a shared language across code, docs, contracts, and tests;
- the project must stay adaptable across Laravel, Go, .NET, Node.js, Spring, or Python implementations.

## When Not to Use

Avoid full hexagonal DDD ceremony when:

- the code is a short-lived script or prototype;
- the behavior is simple data entry with little domain logic;
- abstractions would hide the only real implementation instead of protecting a boundary;
- the team is not ready to maintain ports, adapters, and contract tests.

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

## Trade-offs

- Ports make adapters replaceable, but unnecessary ports create indirection.
- Domain tests become fast and focused, but integration tests are still required for adapters.
- DDD language improves clarity, but poorly named aggregates and services can make the model harder to understand.
- Repositories protect aggregate persistence, but using repositories for every read query creates friction.
- Strategy objects make provider choice explicit, but they should not become a dumping ground for unrelated behavior.

## Common Mistakes

- Letting domain objects import framework classes, ORM models, or HTTP request types.
- Treating every table as an aggregate root.
- Creating generic repositories for reporting and list screens.
- Putting business decisions inside infrastructure adapters.
- Calling adapters directly from controllers instead of application use cases.
- Adding ports for code that has no real boundary or replacement pressure.

## Verification Checklist

- [ ] Can domain tests run without database?
- [ ] Can application tests use fake ports?
- [ ] Are adapters replaceable?
- [ ] Are queries separated from aggregate repositories?
- [ ] Do interfaces call application use cases instead of infrastructure directly?
- [ ] Does the domain language match module documentation and contracts?
