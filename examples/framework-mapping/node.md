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
