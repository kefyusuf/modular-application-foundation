# Testing Standard

## Purpose

Define testing layers needed for a production-grade modular application foundation.

## Baseline Rules

- Domain and application behavior must be unit-testable without infrastructure.
- Adapters must have integration tests against realistic dependencies or fakes with contract proof.
- Public APIs and event schemas must have contract tests.
- Architecture tests must enforce dependency direction and module boundaries.
- Security tests must cover authentication, authorization, CSRF, JWT, rate limits, and object-level access.
- Concurrency and idempotency behavior must be tested for critical workflows.
- Event replay and projection rebuild behavior must be tested where event sourcing or projections exist.

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

## Common Mistakes

- Testing only controllers and skipping domain/application behavior.
- Mocking every adapter and never proving real integration behavior.
- Treating contract docs as tests without machine-readable validation.
- Skipping negative authorization and object-level authorization cases.
- Ignoring duplicate delivery, retry, and race-condition cases.
- Testing happy-path event handling but not replay or dead-letter behavior.
- Allowing architecture rules to exist only in review comments.

## Verification Checklist

- [ ] Are module boundaries testable?
- [ ] Are contracts tested?
- [ ] Are security controls tested?
- [ ] Are concurrency cases tested?
- [ ] Are event replays tested?
