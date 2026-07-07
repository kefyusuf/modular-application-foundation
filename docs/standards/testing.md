# Testing Standard

## Purpose

Define testing layers needed for a production-grade modular application foundation.

## Test Types

| Type | Purpose |
|---|---|
| Unit | domain and application behavior |
| Integration | DB/cache/queue/storage adapters |
| Contract | OpenAPI/AsyncAPI/protobuf/GraphQL compatibility |
| Architecture | boundary rules and dependency direction |
| Security | auth, authorization, CSRF, JWT, rate limit |
| E2E | critical user flows |
| Migration | database changes |
| Replay | event replay and projection rebuild |
| Concurrency | race conditions and locking |

## Architecture Test Examples

```txt
domain must not import framework packages
module A must not import module B private internals
interfaces must not call repositories directly
events must be versioned
controllers must return response DTOs, not domain entities
```

## Verification Checklist

- [ ] Are module boundaries testable?
- [ ] Are contracts tested?
- [ ] Are security controls tested?
- [ ] Are concurrency cases tested?
- [ ] Are event replays tested?
