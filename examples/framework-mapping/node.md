# Framework Mapping: Node.js / TypeScript

## Purpose

This guide maps the foundation to Node.js/TypeScript and deepens it into an adapter blueprint: package layout, kernel ports, composition root, feature slices, HTTP and persistence adapters, boundary enforcement, and tests.

TypeScript is the implementation language for this blueprint. Express, Fastify, NestJS, Prisma, Drizzle, and BullMQ remain replaceable adapters, not the architecture.

## Mapping

| Foundation Concept | Node/TypeScript Mapping |
|---|---|
| Module registry | explicit module bootstrap registry |
| DI container | tsyringe/inversify/Nest container/custom |
| Command bus | typed dispatcher |
| Query bus | typed dispatcher |
| Event bus | in-process bus + outbox publisher |
| Event store | append-only SQL or event DB adapter |
| Unit of work | ORM/SQL flush coordinator |
| Repository adapter | Prisma/Drizzle/Knex implementation |
| Specification | typed predicates + query criteria translator |
| Policy evaluator | custom policy service |
| Cache store | Redis or in-process adapter |
| Queue | BullMQ/RabbitMQ/SQS adapter |
| Secret manager | env/file/cloud secret adapter |
| REST interface | Express/Fastify/Nest adapter |
| Observability | OpenTelemetry JS |

## Recommended Layout

Single deployable app with strongly isolated modules. Package boundaries can grow later if extraction is needed.

```txt
src/
  kernel/
    contracts/          # ports only: CommandBus, EventBus, Repository, ...
    bootstrap/          # composition root, module registry
  modules/
    identity/
      public/           # contracts, dto, events, commands, queries, permissions
      domain/
      application/
        features/
          register-user/
      infrastructure/
      interfaces/
      tests/
    access/
    audit/
  adapters/             # optional shared infra adapters if not module-owned
  app/
    http/
    workers/
    main.ts
```

Rules:

- `modules/*/public` is the only cross-module import surface.
- `domain` and `application` never import Express, Prisma, Redis, BullMQ, or OpenTelemetry SDKs.
- `infrastructure` implements ports; `interfaces` call application use cases.
- Shared `adapters/` is allowed for kernel-level ports, not for business data access.

## Module Slice

```txt
modules/identity/
  public/
    contracts/IdentityReader.ts
    dto/UserSummary.ts
    events/index.ts
    permissions.ts
  domain/
    user/User.ts
    user/Email.ts
    events/UserRegistered.ts
  application/
    features/register-user/
      RegisterUserCommand.ts
      RegisterUserHandler.ts
      RegisterUserValidator.ts
      RegisterUserPolicy.ts
      RegisterUserResult.ts
      register-user.test.ts
    ports/UserRepository.ts
  infrastructure/
    persistence/PrismaUserRepository.ts
  interfaces/
    http/registerUserRoute.ts
  tests/
    integration/
```

## Kernel Ports (TypeScript)

Contracts stay language-neutral in `kernel/contracts/`. These TypeScript shapes are adapter-facing equivalents, not a new standard.

```ts
// kernel ports used by modules
export interface CommandHandler<C, R> {
  execute(command: C): Promise<R>;
}

export interface CommandBus {
  dispatch<C, R>(command: C): Promise<R>;
}

export interface QueryHandler<Q, R> {
  execute(query: Q): Promise<R>;
}

export interface EventBus {
  publish(event: DomainEvent | IntegrationEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
}

export interface Repository<TAggregate, TId> {
  get(id: TId): Promise<TAggregate>;
  save(aggregate: TAggregate, expectedVersion: number): Promise<void>;
}

export interface UnitOfWork {
  commit(): Promise<void>;
  discard(): void;
}

export interface TransactionManager {
  withinTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface PolicyEvaluator {
  can(actor: Actor, action: string, resource?: object, context?: object): Promise<boolean>;
}

export interface Outbox {
  enqueue(event: IntegrationEvent): void; // same transaction as state change
}
```

Domain and application modules depend on these interfaces. Concrete classes live under `infrastructure/`.

## Composition Root

One bootstrap wires kernel ports, modules, and adapters. Feature code never constructs infrastructure types.

```ts
// app/main.ts
const container = createContainer({
  commandBus: new InMemoryCommandBus(),
  queryBus: new InMemoryQueryBus(),
  eventBus: new LoggingEventBus(new OutboxEventBus(outbox)),
  transactionManager: new PrismaTransactionManager(prisma),
  policyEvaluator: new PolicyEvaluatorService(),
  idempotencyStore: new PostgresIdempotencyStore(prisma),
  lockManager: new RedisLockManager(redis),
  cacheStore: new RedisCacheStore(redis),
  queue: new BullMqQueue(bullConnection),
  secretManager: new EnvSecretManager(),
  observability: new OpenTelemetryObservability(),
});

const registry = new ModuleRegistry(container);
registry.register(identityModule);
registry.register(accessModule);
registry.register(auditModule);

await startHttpServer(registry);
await startWorkers(registry);
```

Module `register` functions export public contracts and handlers only. Private repositories stay inside the module.

## Feature Slice Walkthrough

Command: register a user. The slice owns validation, policy, domain work, and result mapping.

```ts
// application/features/register-user/RegisterUserHandler.ts
export class RegisterUserHandler implements CommandHandler<RegisterUserCommand, RegisterUserResult> {
  constructor(
    private readonly users: UserRepository,
    private readonly events: EventBus,
    private readonly tx: TransactionManager,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    return this.tx.withinTransaction(async () => {
      const user = User.register(command.email, command.passwordHash);
      await this.users.save(user, 0);
      for (const event of user.pullDomainEvents()) {
        await this.events.publish(event); // integration events go through outbox
      }
      return { userId: user.id.value, email: user.email.value };
    });
  }
}
```

```ts
// interfaces/http/registerUserRoute.ts
http.post('/api/v1/identity/users', async (req, reply) => {
  const dto = RegisterUserRequest.parse(req.body); // runtime validation at the boundary
  await authz.ensure(req.actor, 'identity.user.create');
  const result = await commandBus.dispatch(toCommand(dto));
  return reply.code(201).json(result); // result contract, not domain entity
});
```

Checklist for every slice:

- one use case per folder;
- validator on input contract;
- policy check even if middleware already authenticated;
- repository and event ports only;
- returns a result DTO;
- unit test without HTTP or database.

## HTTP Adapter Notes

- Controllers map DTOs to commands/queries and results to HTTP responses.
- Runtime validation is required at every untrusted boundary (zod, valibot, ajv, or class-validator).
- Problem Details error shape is the public error contract.
- Auth middleware establishes actor context; features still call the policy evaluator.
- Never return Prisma/Drizzle entities or domain aggregates from routes.

## Persistence Adapter Notes

- One schema or table namespace per module where the database allows it.
- Repositories load/save aggregates only; list screens use query models or projections.
- Optimistic concurrency uses an expected version on save.
- Outbox rows are inserted in the same transaction as the state change.
- Prefer explicit SQL or a thin query layer over leaking the ORM across module lines.

```ts
// infrastructure/persistence/PrismaUserRepository.ts
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(user: User, expectedVersion: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id.value, version: expectedVersion },
      data: user.toPersistence(),
    });
  }
}
```

## Events, Queue, and Workers

- Domain events stay in-process inside the module use case.
- Integration events are written to outbox, then published by a relay.
- Queue jobs are commands or handlers that must be idempotent.
- Workers use inbox/idempotency records; BullMQ/RabbitMQ/SQS redelivers.

```ts
// good: durable, transactional
await tx.withinTransaction(async () => {
  await users.save(user, expected);
  outbox.enqueue(UserRegisteredV1.from(user));
});

// wrong: best-effort side effect outside the state change
await users.save(user, expected);
await queue.enqueue('send-welcome-email', { userId: user.id.value });
```

## Boundary Enforcement in Tooling

TypeScript paths and lint rules must encode module privacy.

```jsonc
// tsconfig paths (illustrative)
{
  "compilerOptions": {
    "paths": {
      "@kernel/*": ["src/kernel/*"],
      "@modules/identity/public/*": ["src/modules/identity/public/*"],
      "@modules/identity/*": ["src/modules/identity/*"]
    }
  }
}
```

Enforcement options:

- `eslint-plugin-import` / `eslint-plugin-boundaries` / `dependency-cruiser` rules;
- forbid `modules/*/*` deep imports from another module;
- allow `@modules/<name>/public/*` only for cross-module use;
- forbid `express`, `@prisma/client`, `ioredis`, `bullmq` from `domain` and `application`;
- CI runs the same rules as local `npm run lint`.

Pseudo-rule:

```txt
from modules.A -> modules.B:
  allow B/public/**
  deny  B/domain/** B/application/** B/infrastructure/** B/interfaces/**

from modules/**/domain and application:
  deny express fastify nestjs @prisma/client ioredis bullmq @opentelemetry/*
```

## Testing

| Layer | Approach |
|---|---|
| domain | pure unit tests, no I/O |
| application | unit tests with in-memory ports |
| infrastructure | integration tests against real Postgres/Redis |
| interfaces | supertest/fastify inject tests |
| architecture | dependency-cruiser or eslint boundary rules in CI |
| workers | idempotency and redelivery tests |

Application tests should pass without opening an HTTP server or a database connection.

## Trade-offs

- Explicit ports keep domain code portable, but they add indirection over a single-framework app.
- Runtime validators at boundaries add code, but TypeScript types erase at runtime and cannot protect untrusted input.
- Outbox and inbox improve reliability, but they require workers and operational visibility.
- Path-alias boundaries are cheap to start, but serious isolation still benefits from architecture tests and review discipline.
- A monorepo package split can harden boundaries later; starting with one package keeps the blueprint teachable.

## Common Mistakes

- Importing Prisma types into domain entities.
- Returning ORM rows from controllers.
- Skipping policy checks because auth middleware already ran.
- Enqueueing jobs outside the transaction that changed state.
- Treating TypeScript types as sufficient API validation.
- Sharing one `services/` folder across modules.
- Using repositories for every list/report query.
- Letting NestJS modules define the domain model instead of the reverse.

## Verification

- [ ] Do path aliases and lint rules prevent private cross-module imports?
- [ ] Are database clients kept behind repositories or query adapters?
- [ ] Are controllers/resolvers mapping DTOs instead of returning domain entities?
- [ ] Are async consumers idempotent?
- [ ] Is every untrusted input validated at runtime?
- [ ] Are integration events written to outbox in the same transaction as state changes?
- [ ] Can application feature tests run without HTTP, Prisma, Redis, or BullMQ?
- [ ] Do domain and application layers stay free of framework and SDK imports?
- [ ] Does each module declare exports/imports in `module.manifest.yml`?
- [ ] Are results returned as public contracts rather than domain aggregates?
