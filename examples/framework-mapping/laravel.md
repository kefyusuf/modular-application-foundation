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

## Boundary Notes

- Domain code should not depend on Eloquent models, requests, facades, or jobs.
- Application features may use ports that Laravel adapters implement.
- Integration events still require outbox/inbox even if Laravel events are used internally.
- Policies should wrap the foundation `PolicyEvaluator` contract instead of hardcoded role checks.

## Verification

- [ ] Can domain tests run without Laravel bootstrapping?
- [ ] Are Eloquent models hidden behind repositories or query adapters?
- [ ] Are service providers binding public contracts, not private cross-module classes?
- [ ] Are queued listeners idempotent?
