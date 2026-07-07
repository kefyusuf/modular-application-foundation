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
