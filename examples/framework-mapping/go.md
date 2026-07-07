# Framework Mapping: Go

## Purpose

This guide maps the framework-agnostic architecture to Go concepts without making Go the source of truth.

## Mapping

| Foundation Concept | Go Mapping |
|---|---|
| Module registry | explicit registry package |
| DI container | constructor injection / fx / wire / custom registry |
| Command bus | interface + handler map |
| Query bus | interface + handler map |
| Event bus | interface + in-memory/broker adapter |
| Repository adapter | pgx/sqlc/GORM implementation of interface |
| Policy evaluator | interface + implementation |
| REST interface | net/http, chi, gin, echo adapters |
| Jobs | worker goroutines + queue adapter |
| Observability | OpenTelemetry SDK |

## Rule

Go packages must preserve module boundary rules. Package imports are architecture decisions.

## Boundary Notes

- Domain packages should not import HTTP, SQL, queue, or framework packages.
- Application packages should depend on interfaces, not concrete adapters.
- Internal package visibility can help enforce module boundaries.
- Broker consumers still need durable inbox/idempotency.

## Verification

- [ ] Do package imports follow module dependency direction?
- [ ] Are adapters behind interfaces?
- [ ] Are generated SQL or ORM types kept out of domain packages?
- [ ] Are event consumers idempotent and observable?
