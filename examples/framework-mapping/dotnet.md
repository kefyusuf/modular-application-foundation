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
