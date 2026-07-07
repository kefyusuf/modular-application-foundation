# Framework Mapping: .NET

## Purpose

This guide maps the foundation to .NET concepts.

## Mapping

| Foundation Concept | .NET Mapping |
|---|---|
| Module registry | application composition root / module registration extensions |
| DI container | built-in Microsoft.Extensions.DependencyInjection |
| Command bus | MediatR-like or custom dispatcher |
| Query bus | custom query dispatcher |
| Event bus | domain events + outbox publisher |
| Repository adapter | EF Core / Dapper implementation |
| Policy evaluator | authorization policies behind foundation contract |
| REST interface | ASP.NET Core controllers/minimal APIs |
| Jobs | hosted services / background workers |
| Observability | OpenTelemetry .NET |

## Rule

Projects/namespaces must enforce dependency direction.

## Boundary Notes

- Domain projects should not reference ASP.NET Core, EF Core, or messaging packages.
- Application projects should depend on ports and contracts.
- Infrastructure projects implement adapters for persistence, messaging, storage, and identity providers.
- ASP.NET Core authorization policies should delegate to the foundation policy evaluator.

## Verification

- [ ] Do project references point inward toward domain/application contracts?
- [ ] Are EF Core entities hidden from public API contracts?
- [ ] Are integration events published through outbox?
- [ ] Are background workers idempotent?
