# Framework Mapping: Laravel

## Purpose

This guide maps the framework-agnostic architecture to Laravel concepts without making Laravel the source of truth.

## Mapping

| Foundation Concept | Laravel Mapping |
|---|---|
| Module registry | Service providers / package discovery / custom module loader |
| DI container | Laravel service container |
| Command bus | Bus / custom command handler map |
| Query bus | custom query bus |
| Event bus | Laravel events plus outbox for integration events |
| Repository adapter | Eloquent/query builder implementation of application port |
| Policy evaluator | Laravel policies/gates behind foundation contract |
| REST interface | routes/controllers/resources |
| Jobs | queues/workers |
| Observability | logs, metrics, OpenTelemetry adapter |

## Rule

Laravel is an adapter implementation detail. Domain and application rules remain framework-neutral.
