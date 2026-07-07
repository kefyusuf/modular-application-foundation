# Framework Mapping: Node.js / TypeScript

## Purpose

This guide maps the foundation to Node.js/TypeScript concepts.

## Mapping

| Foundation Concept | Node/TypeScript Mapping |
|---|---|
| Module registry | explicit module bootstrap registry |
| DI container | tsyringe/inversify/Nest container/custom |
| Command bus | typed dispatcher |
| Query bus | typed dispatcher |
| Event bus | in-process bus + outbox publisher |
| Repository adapter | Prisma/Drizzle/Knex implementation |
| Policy evaluator | custom policy service |
| REST interface | Express/Fastify/Nest adapter |
| Jobs | BullMQ/RabbitMQ/SQS adapter |
| Observability | OpenTelemetry JS |

## Rule

TypeScript types are contracts, but runtime validation is still required at boundaries.

## Boundary Notes

- Domain code should not import Express, Fastify, NestJS decorators, database clients, or queue SDKs.
- Application features should depend on interfaces and DTOs.
- Adapters can live in framework-specific packages, but module public contracts stay stable.
- Worker consumers still need inbox/idempotency.

## Verification

- [ ] Do path aliases prevent private cross-module imports?
- [ ] Are database clients kept behind repositories or query adapters?
- [ ] Are controllers/resolvers mapping DTOs instead of returning domain entities?
- [ ] Are async consumers idempotent?
