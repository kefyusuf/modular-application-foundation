# Framework Mapping: Laravel

## Purpose

This guide maps the foundation to Laravel and deepens it into an adapter blueprint: package layout, kernel ports, service providers, feature slices, HTTP and persistence adapters, queue/outbox, boundary enforcement, and tests.

Laravel is the host runtime for this blueprint. Eloquent, HTTP kernel, jobs, and facades remain replaceable adapters, not the architecture.

## Mapping

| Foundation Concept | Laravel Mapping |
|---|---|
| Module registry | Service providers / package discovery / custom module loader |
| DI container | Laravel service container |
| Command bus | Bus / custom command handler map |
| Query bus | custom query bus |
| Event store | append-only Eloquent/query store adapter |
| Unit of work | database transaction + pending changes coordinator |
| Event bus | Laravel events plus outbox for integration events |
| Repository adapter | Eloquent/query builder implementation of application port |
| Specification | domain predicates + query builder translator |
| Policy evaluator | Laravel policies/gates behind foundation contract |
| Cache store | Redis/cache repository adapter |
| Queue | queues/workers (database, Redis, SQS) |
| Secret manager | env/config/vault adapter |
| REST interface | routes/controllers/API resources |
| Observability | logs, metrics, OpenTelemetry adapter |

## Recommended Layout

One Laravel application with strongly isolated modules. Extract to packages later only if needed.

```txt
app/
  Kernel/
    Contracts/          # ports: CommandBus, EventBus, Repository, ...
    Modules/            # module registry and loaders
    Providers/          # composition root bindings
  Modules/
    Identity/
      Public/
        Contracts/
        Dto/
        Events/
        Commands/
        Queries/
        Permissions/
      Domain/
        User/
        Email/
        Events/
      Application/
        Features/
          RegisterUser/
            RegisterUserCommand.php
            RegisterUserHandler.php
            RegisterUserValidator.php
            RegisterUserPolicy.php
            RegisterUserResult.php
            RegisterUserTest.php
        Ports/
          UserRepository.php
      Infrastructure/
        Persistence/
          EloquentUserRepository.php
      Interfaces/
        Http/
          RegisterUserController.php
        routes.php
      Providers/
        IdentityServiceProvider.php
      module.manifest.yml
    Access/
    Audit/
routes/
  api.php
config/
  modules.php
tests/
  Architecture/
```

Rules:

- `Modules/*/Public` is the only cross-module import surface.
- `Domain` and `Application` never import Eloquent, Request, Facade, Job, or HTTP classes.
- `Infrastructure` implements ports; `Interfaces` call application use cases.
- Kernel contracts live under `app/Kernel/Contracts`, not inside a module.

## Kernel Ports (PHP)

Contracts stay language-neutral in `kernel/contracts/`. These PHP interfaces are adapter-facing equivalents.

```php
// app/Kernel/Contracts
interface CommandHandler
{
    public function execute(object $command): mixed;
}

interface CommandBus
{
    public function dispatch(object $command): mixed;
}

interface QueryBus
{
    public function fetch(object $query): mixed;
}

interface EventBus
{
    public function publish(DomainEvent|IntegrationEvent $event): void;
    public function subscribe(string $eventType, callable $handler): void;
}

interface Repository
{
    public function get(string $id): object;
    public function save(object $aggregate, int $expectedVersion): void;
}

interface UnitOfWork
{
    public function commit(): void;
    public function discard(): void;
}

interface TransactionManager
{
    public function withinTransaction(callable $callback): mixed;
}

interface PolicyEvaluator
{
    public function can(Actor $actor, string $action, ?object $resource = null, array $context = []): bool;
}

interface Outbox
{
    public function enqueue(IntegrationEvent $event): void;
}
```

Module code type-hints these interfaces. Concrete Eloquent, Redis, and queue classes bind in service providers.

## Composition Root

Service providers wire kernel ports and modules. Feature code never resolves Eloquent models or facades directly.

```php
// app/Providers/AppServiceProvider.php
public function register(): void
{
    $this->app->singleton(CommandBus::class, InMemoryCommandBus::class);
    $this->app->singleton(QueryBus::class, InMemoryQueryBus::class);
    $this->app->singleton(EventBus::class, OutboxEventBus::class);
    $this->app->singleton(TransactionManager::class, DatabaseTransactionManager::class);
    $this->app->singleton(PolicyEvaluator::class, FoundationPolicyEvaluator::class);
    $this->app->singleton(IdempotencyStore::class, DatabaseIdempotencyStore::class);
    $this->app->singleton(LockManager::class, RedisLockManager::class);
    $this->app->singleton(CacheStore::class, RedisCacheStore::class);
    $this->app->singleton(Queue::class, LaravelQueueAdapter::class);
    $this->app->singleton(SecretManager::class, EnvSecretManager::class);
}

// app/Modules/Identity/Providers/IdentityServiceProvider.php
public function register(): void
{
    $this->app->bind(UserRepository::class, EloquentUserRepository::class);
    $this->app->tag([RegisterUserHandler::class], 'command_handlers');
}
```

A small module loader can read `module.manifest.yml` and register routes, migrations, permissions, and event subscribers per module.

## Feature Slice Walkthrough

Command: register a user. The slice owns validation, policy, domain work, and result mapping.

```php
// Application/Features/RegisterUser/RegisterUserHandler.php
final class RegisterUserHandler implements CommandHandler
{
    public function __construct(
        private UserRepository $users,
        private EventBus $events,
        private TransactionManager $tx,
    ) {}

    public function execute(object $command): mixed
    {
        assert($command instanceof RegisterUserCommand);

        return $this->tx->withinTransaction(function () use ($command): RegisterUserResult {
            $user = User::register(
                Email::from($command->email),
                PasswordHash::from($command->passwordHash),
            );

            $this->users->save($user, 0);

            foreach ($user->pullDomainEvents() as $event) {
                $this->events->publish($event);
            }

            return new RegisterUserResult($user->id(), $user->email());
        });
    }
}
```

```php
// Interfaces/Http/RegisterUserController.php
final class RegisterUserController
{
    public function __invoke(RegisterUserRequest $request, CommandBus $bus, PolicyEvaluator $policy): JsonResponse
    {
        $actor = $request->user() ? Actor::fromUser($request->user()) : Actor::guest();
        abort_unless($policy->can($actor, 'identity.user.create'), 403);

        $result = $bus->dispatch(
            new RegisterUserCommand($request->validated('email'), $request->validated('password_hash'))
        );

        return response()->json($result, 201);
    }
}
```

Checklist for every slice:

- one use case per folder;
- FormRequest or validator on input contract;
- policy check even if middleware already authenticated;
- repository and event ports only;
- returns a result DTO or API resource, not an Eloquent model;
- unit test without HTTP or database.

## HTTP Adapter Notes

- Controllers map validated input to commands/queries and results to JSON/API resources.
- FormRequest or explicit validators run at every untrusted boundary.
- Problem Details error shape is the public error contract (custom handler if Laravel’s default is used).
- Auth middleware establishes actor context; features still call `PolicyEvaluator`.
- Never return Eloquent models or domain aggregates from controllers.
- API Resources are presentation mapping only, not domain logic.

## Persistence Adapter Notes

- One database schema or table prefix per module where possible.
- Eloquent models live only under `Infrastructure/Persistence`.
- Repositories load/save aggregates only; list screens use query models or read models.
- Optimistic concurrency uses an expected version on save.
- Outbox rows insert in the same `DB::transaction` as the state change.
- Prefer query builder/SQL for module-owned tables over sharing models across modules.

```php
// Infrastructure/Persistence/EloquentUserRepository.php
final class EloquentUserRepository implements UserRepository
{
    public function save(object $aggregate, int $expectedVersion): void
    {
        assert($aggregate instanceof User);

        $updated = UserModel::query()
            ->where('id', $aggregate->id())
            ->where('version', $expectedVersion)
            ->update($aggregate->toPersistence());

        if ($updated !== 1) {
            throw new ConcurrencyConflict();
        }
    }
}
```

## Events, Queue, and Workers

- Domain events stay in-process inside the module use case.
- Integration events are written to outbox, then published by a relay.
- Laravel queued listeners and jobs must be idempotent.
- Workers use inbox/idempotency records; the queue redelivers.

```php
// good: durable, transactional
$this->tx->withinTransaction(function () use ($user, $expectedVersion) {
    $this->users->save($user, $expectedVersion);
    $this->outbox->enqueue(UserRegisteredV1::from($user));
});

// wrong: best-effort side effect outside the state change
$this->users->save($user, $expectedVersion);
SendWelcomeEmail::dispatch($user->id());
```

Do not use Laravel model events as the integration event backbone without outbox guarantees.

## Boundary Enforcement in Tooling

Composer autoload and static analysis must encode module privacy.

```json
// composer.json (illustrative PSR-4)
{
  "autoload": {
    "psr-4": {
      "App\\Kernel\\": "app/Kernel/",
      "App\\Modules\\Identity\\": "app/Modules/Identity/",
      "App\\Modules\\Access\\": "app/Modules/Access/"
    }
  }
}
```

Enforcement options:

- PHPStan / Psalm baseline with forbidden `use` rules;
- `deptrac` or custom architecture tests;
- forbid `Illuminate\Database\Eloquent`, `Illuminate\Http\Request`, `Illuminate\Support\Facades` in `Domain` and `Application`;
- allow `Modules\*\Public\*` only for cross-module use;
- CI runs the same rules as local `composer qa`.

Pseudo-rule:

```txt
from Modules.A -> Modules.B:
  allow B\Public\**
  deny  B\Domain\** B\Application\** B\Infrastructure\** B\Interfaces\**

from Domain and Application:
  deny Illuminate\Database\Eloquent Illuminate\Http\Request Illuminate\Support\Facades
```

## Testing

| Layer | Approach |
|---|---|
| domain | pure PHPUnit unit tests, no container |
| application | unit tests with in-memory ports |
| infrastructure | integration tests against real Postgres/Redis |
| interfaces | HTTP tests via Laravel test client |
| architecture | PHPStan/Deptrac/module rules in CI |
| workers | idempotency and redelivery tests |

Application tests should pass without booting HTTP routes or hitting Eloquent.

## Trade-offs

- Explicit ports keep domain code portable, but they add indirection over a pure Laravel app.
- Hiding Eloquent protects boundaries, but teams used to ActiveRecord need clear repository guidance.
- Outbox and inbox improve reliability, but they require workers and visibility.
- Service providers are a natural module loader, but they must not become a second domain model.
- Deptrac/PHPStan rules add CI cost, but they make module privacy reviewable.

## Common Mistakes

- Importing Eloquent models into domain entities.
- Returning models from controllers or API resources that expose relations carelessly.
- Skipping policy checks because auth middleware already ran.
- Dispatching jobs outside the transaction that changed state.
- Using Laravel events as durable integration events without outbox.
- Sharing one `app/Services` folder across modules.
- Facades inside domain code.
- Using repositories for every list/report query.

## Verification

- [ ] Can domain tests run without Laravel bootstrapping?
- [ ] Are Eloquent models hidden behind repositories or query adapters?
- [ ] Are service providers binding public contracts, not private cross-module classes?
- [ ] Are queued listeners idempotent?
- [ ] Is every untrusted input validated at the boundary?
- [ ] Are integration events written to outbox in the same transaction as state changes?
- [ ] Do domain and application layers stay free of Eloquent, Request, and Facades?
- [ ] Does each module declare exports/imports in `module.manifest.yml`?
- [ ] Are controllers mapping DTOs instead of returning domain entities or models?
- [ ] Are architecture checks (PHPStan/Deptrac) running in CI?
