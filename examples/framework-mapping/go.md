# Framework Mapping: Go

## Purpose

This guide maps the foundation to Go and deepens it into an adapter blueprint: package layout, kernel ports, composition root, feature slices, HTTP and persistence adapters, workers, boundary enforcement, and tests.

Go is the host language for this blueprint. net/http, chi/gin/echo, pgx/sqlc/GORM, and broker clients remain replaceable adapters, not the architecture.

## Mapping

| Foundation Concept | Go Mapping |
|---|---|
| Module registry | explicit registry package |
| DI container | constructor injection / fx / wire / custom registry |
| Command bus | interface + handler map |
| Query bus | interface + handler map |
| Event store | append-only SQL event store adapter |
| Unit of work | TxManager + pending changes |
| Event bus | interface + in-memory/broker adapter |
| Repository adapter | pgx/sqlc/GORM implementation of interface |
| Specification | predicate funcs + query builder translator |
| Policy evaluator | interface + implementation |
| Cache store | Redis/in-memory adapter |
| Queue | asynq/amqp/sqs worker adapter |
| Secret manager | env/file/cloud secret adapter |
| REST interface | net/http, chi, gin, echo adapters |
| Observability | OpenTelemetry SDK |

## Recommended Layout

One binary, modules as `internal` packages so the compiler helps enforce privacy.

```txt
cmd/
  api/
    main.go
  worker/
    main.go
internal/
  kernel/
    contracts/          # ports only
    bootstrap/          # composition root, module registry
  modules/
    identity/
      public/           # contracts, dto, events, commands, queries
      domain/
        user.go
        email.go
        events.go
      application/
        features/
          registeruser/
            command.go
            handler.go
            validator.go
            policy.go
            result.go
            handler_test.go
        ports/
          user_repository.go
      infrastructure/
        persistence/
          pg_user_repository.go
      interfaces/
        http/
          register_user_handler.go
          routes.go
    access/
    audit/
  adapters/             # optional shared kernel adapters
  app/
    http/
    workers/
    bootstrap.go
```

Rules:

- `modules/*/public` is the only cross-module import surface.
- `domain` and `application` do not import net/http, database/sql, pgx, GORM, or broker SDKs.
- `infrastructure` implements ports; `interfaces` calls application use cases.
- Kernel contracts live under `internal/kernel/contracts`, not inside a module.

## Kernel Ports (Go)

Contracts stay language-neutral in `kernel/contracts/`. These Go interfaces are adapter-facing equivalents.

```go
// internal/kernel/contracts
type CommandHandler[C any, R any] interface {
    Handle(ctx context.Context, cmd C) (R, error)
}

type CommandBus interface {
    Dispatch(ctx context.Context, cmd any) (any, error)
}

type QueryBus interface {
    Fetch(ctx context.Context, query any) (any, error)
}

type EventBus interface {
    Publish(ctx context.Context, event any) error
    Subscribe(eventType string, handler EventHandler) error
}

type Repository[T any, ID comparable] interface {
    Get(ctx context.Context, id ID) (T, error)
    Save(ctx context.Context, aggregate T, expectedVersion int) error
}

type UnitOfWork interface {
    Commit(ctx context.Context) error
    Discard()
}

type TransactionManager interface {
    WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type PolicyEvaluator interface {
    Can(ctx context.Context, actor Actor, action string, resource any) (bool, error)
}

type Outbox interface {
    Enqueue(event any) // same transaction as state change
}
```

Application packages depend on these interfaces. Concrete types live under `infrastructure`.

## Composition Root

`bootstrap` wires kernel ports and modules. Feature code never constructs database or broker clients.

```go
// internal/app/bootstrap.go
func NewApp(deps Deps) (*App, error) {
    container := kernel.NewContainer(
        kernel.WithCommandBus(NewInMemoryCommandBus()),
        kernel.WithQueryBus(NewInMemoryQueryBus()),
        kernel.WithEventBus(NewOutboxEventBus(deps.Outbox)),
        kernel.WithTransactionManager(NewTxManager(deps.DB)),
        kernel.WithPolicyEvaluator(NewPolicyEvaluator()),
        kernel.WithIdempotencyStore(NewPostgresIdempotencyStore(deps.DB)),
        kernel.WithLockManager(NewRedisLockManager(deps.Redis)),
        kernel.WithCacheStore(NewRedisCacheStore(deps.Redis)),
        kernel.WithQueue(NewAsynqQueue(deps.Redis)),
        kernel.WithSecretManager(NewEnvSecretManager()),
        kernel.WithObservability(NewOTelObservability()),
    )

    registry := kernel.NewModuleRegistry(container)
    registry.Register(identity.NewModule())
    registry.Register(access.NewModule())
    registry.Register(audit.NewModule())

    return &App{Registry: registry}, nil
}
```

Module `NewModule` constructors export public contracts and handlers only. Private repositories stay inside the module package tree.

## Feature Slice Walkthrough

Command: register a user. The slice owns validation, policy, domain work, and result mapping.

```go
// application/features/registeruser/handler.go
type Handler struct {
    users UserRepository
    events EventBus
    tx    TransactionManager
}

func (h *Handler) Handle(ctx context.Context, cmd Command) (Result, error) {
    var result Result
    err := h.tx.WithinTransaction(ctx, func(ctx context.Context) error {
        user, err := domain.RegisterUser(cmd.Email, cmd.PasswordHash)
        if err != nil {
            return err
        }
        if err := h.users.Save(ctx, user, 0); err != nil {
            return err
        }
        for _, event := range user.PullDomainEvents() {
            if err := h.events.Publish(ctx, event); err != nil {
                return err
            }
        }
        result = Result{UserID: user.ID, Email: user.Email}
        return nil
    })
    return result, err
}
```

```go
// interfaces/http/register_user_handler.go
func (h *RegisterUserHTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    req, err := ParseRegisterUserRequest(r) // runtime validation at the boundary
    if err != nil {
        problem.Write(w, r, problem.InvalidRequest(err))
        return
    }

    actor := ActorFromContext(r.Context())
    ok, err := h.policy.Can(r.Context(), actor, "identity.user.create", nil)
    if err != nil || !ok {
        problem.Write(w, r, problem.Forbidden())
        return
    }

    result, err := h.bus.Dispatch(r.Context(), registeruser.Command{
        Email:        req.Email,
        PasswordHash: req.PasswordHash,
    })
    if err != nil {
        problem.Write(w, r, problem.FromError(err))
        return
    }

    writeJSON(w, http.StatusCreated, result) // result contract, not domain entity
}
```

Checklist for every slice:

- one use case per folder;
- validator on input contract;
- policy check even if middleware already authenticated;
- repository and event ports only;
- returns a result DTO;
- unit test without HTTP or database.

## HTTP Adapter Notes

- Handlers map request DTOs to commands/queries and results to response DTOs.
- Runtime validation is required at every untrusted boundary (go-playground/validator, oapi-codegen, or hand parsers).
- RFC 9457 Problem Details is the public error contract.
- Auth middleware establishes actor context; features still call `PolicyEvaluator`.
- Never return GORM models or domain aggregates from handlers.

## Persistence Adapter Notes

- One schema or table prefix per module where possible.
- sqlc/pgx/GORM types live only under `infrastructure/persistence`.
- Repositories load/save aggregates only; list screens use query models or projections.
- Optimistic concurrency uses an expected version on save.
- Outbox rows insert in the same transaction as the state change.
- Prefer explicit SQL (sqlc) over sharing ORM models across module lines.

```go
// infrastructure/persistence/pg_user_repository.go
func (r *PGUserRepository) Save(ctx context.Context, user *domain.User, expectedVersion int) error {
    res, err := r.q.UpdateUser(ctx, UpdateUserParams{
        ID:      user.ID,
        Version: expectedVersion,
        Data:    user.ToPersistence(),
    })
    if err != nil {
        return err
    }
    if res.RowsAffected() != 1 {
        return ErrConcurrencyConflict
    }
    return nil
}
```

## Events, Queue, and Workers

- Domain events stay in-process inside the module use case.
- Integration events are written to outbox, then published by a relay.
- Worker goroutines must handle idempotent jobs.
- Consumers use inbox/idempotency records; the broker redelivers.

```go
// good: durable, transactional
err := h.tx.WithinTransaction(ctx, func(ctx context.Context) error {
    if err := h.users.Save(ctx, user, expectedVersion); err != nil {
        return err
    }
    h.outbox.Enqueue(UserRegisteredV1From(user))
    return nil
})

// wrong: best-effort side effect outside the state change
_ = h.users.Save(ctx, user, expectedVersion)
_ = h.queue.Enqueue(ctx, "send-welcome-email", user.ID)
```

## Boundary Enforcement in Tooling

Go’s `internal/` visibility is the first line of defense. Add import lint for cross-module leaks.

Enforcement options:

- keep modules under `internal/modules/<name>` so other modules cannot import private packages accidentally across binaries;
- `depguard` / `importas` / custom `go vet` analyzer for forbidden imports;
- forbid `net/http`, `database/sql`, `pgx`, `gorm`, broker SDKs in `domain` and `application`;
- allow `modules/<other>/public` only for cross-module use;
- CI runs `go test`, `go vet`, and import lint.

Pseudo-rule:

```txt
from modules.A -> modules.B:
  allow B/public/**
  deny  B/domain/** B/application/** B/infrastructure/** B/interfaces/**

from domain and application:
  deny net/http database/sql pgx gorm broker SDKs
```

## Testing

| Layer | Approach |
|---|---|
| domain | pure `go test` unit tests |
| application | unit tests with in-memory ports |
| infrastructure | integration tests against real Postgres/Redis |
| interfaces | httptest handler tests |
| architecture | depguard/import lint in CI |
| workers | idempotency and redelivery tests |

Application tests should pass without opening a database or HTTP server.

## Trade-offs

- `internal/` and small interfaces fit Go idioms, but teams must still police package boundaries.
- Explicit ports keep domain code portable, but they add indirection over a single framework app.
- sqlc is transparent and fast, but schema-per-module needs discipline.
- Outbox and inbox improve reliability, but they require workers and operational visibility.
- Constructor injection is simple, but large apps may want fx/wire without letting it define domain structure.

## Common Mistakes

- Importing GORM/pgx types into domain structs.
- Returning database rows from HTTP handlers.
- Skipping policy checks because auth middleware already ran.
- Enqueueing jobs outside the transaction that changed state.
- Using package-level globals as a hidden DI container for domain services.
- Sharing one `services` package across modules.
- Treating Go interfaces declared in infrastructure as application ports.

## Verification

- [ ] Do package imports follow module dependency direction?
- [ ] Are adapters behind interfaces?
- [ ] Are generated SQL or ORM types kept out of domain packages?
- [ ] Are event consumers idempotent and observable?
- [ ] Is every untrusted input validated at the boundary?
- [ ] Are integration events written to outbox in the same transaction as state changes?
- [ ] Do domain and application packages stay free of HTTP, SQL, and broker SDKs?
- [ ] Does each module declare exports/imports in `module.manifest.yml`?
- [ ] Are handlers mapping DTOs instead of returning domain entities?
- [ ] Are import-lint rules running in CI?
