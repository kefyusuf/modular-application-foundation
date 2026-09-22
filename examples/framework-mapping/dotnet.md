# Framework Mapping: .NET

## Purpose

This guide maps the foundation to .NET and deepens it into an adapter blueprint: solution layout, kernel ports, composition root, feature slices, HTTP and persistence adapters, background workers, boundary enforcement, and tests.

.NET is the host runtime for this blueprint. ASP.NET Core, EF Core, MediatR-style buses, and messaging clients remain replaceable adapters, not the architecture.

## Mapping

| Foundation Concept | .NET Mapping |
|---|---|
| Module registry | application composition root / module registration extensions |
| DI container | built-in Microsoft.Extensions.DependencyInjection |
| Command bus | MediatR-like or custom dispatcher |
| Query bus | custom query dispatcher |
| Event store | append-only EF Core/Dapper store adapter |
| Unit of work | EF Core change tracker + explicit commit boundary |
| Event bus | domain events + outbox publisher |
| Repository adapter | EF Core / Dapper implementation |
| Specification | expression predicates + IQueryable translator |
| Policy evaluator | authorization policies behind foundation contract |
| Cache store | IMemoryCache / Redis adapter |
| Queue | channels / RabbitMQ / SQS hosted workers |
| Secret manager | configuration / Key Vault adapter |
| REST interface | ASP.NET Core controllers/minimal APIs |
| Observability | OpenTelemetry .NET |

## Recommended Layout

A single deployable host with projects (or folders) that enforce dependency direction.

```txt
src/
  Host/                             # ASP.NET Core composition root
    Composition/
    Endpoints/
    Program.cs
  Kernel/
    Contracts/                      # CommandBus, EventBus, Repository, ...
    Modules/                        # module registry
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
        Users/
        Events/
      Application/
        Features/
          RegisterUser/
            RegisterUserCommand.cs
            RegisterUserHandler.cs
            RegisterUserValidator.cs
            RegisterUserPolicy.cs
            RegisterUserResult.cs
            RegisterUserTests.cs
        Abstractions/               # ports (UserRepository, ...)
      Infrastructure/
        Persistence/
          EfUserRepository.cs
      Api/
        RegisterUserEndpoint.cs
      ModuleIdentity.cs             # registration extension
    Access/
    Audit/
tests/
  Modules.Identity.UnitTests/
  Modules.Identity.IntegrationTests/
  Architecture.Tests/
```

Rules:

- `Modules/*/Public` is the only cross-module reference surface.
- `Domain` and `Application` do not reference ASP.NET Core, EF Core, or broker SDKs.
- `Infrastructure` implements ports; `Api` calls application use cases.
- Kernel contracts live in `Kernel.Contracts`, not inside a module.

## Kernel Ports (C#)

Contracts stay language-neutral in `kernel/contracts/`. These C# interfaces are adapter-facing equivalents.

```csharp
// Kernel.Contracts
public interface ICommandHandler<in TCommand, TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken ct);
}

public interface ICommandBus
{
    Task<TResult> DispatchAsync<TResult>(object command, CancellationToken ct);
}

public interface IQueryBus
{
    Task<TResult> FetchAsync<TResult>(object query, CancellationToken ct);
}

public interface IEventBus
{
    Task PublishAsync(IDomainEvent @event, CancellationToken ct);
    Task PublishAsync(IIntegrationEvent @event, CancellationToken ct);
}

public interface IRepository<TAggregate, in TId>
    where TAggregate : class
{
    Task<TAggregate> GetAsync(TId id, CancellationToken ct);
    Task SaveAsync(TAggregate aggregate, int expectedVersion, CancellationToken ct);
}

public interface IUnitOfWork
{
    Task CommitAsync(CancellationToken ct);
    void Discard();
}

public interface ITransactionManager
{
    Task<T> WithinTransactionAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct);
}

public interface IPolicyEvaluator
{
    Task<bool> CanAsync(Actor actor, string action, object? resource = null, CancellationToken ct = default);
}

public interface IOutbox
{
    void Enqueue(IIntegrationEvent @event);
}
```

Application and domain projects reference only these abstractions and `Public` contracts.

## Composition Root

The host project wires kernel ports and modules. Feature code never news up `DbContext` or broker clients.

```csharp
// Host/Program.cs (illustrative)
builder.Services.AddSingleton<ICommandBus, InMemoryCommandBus>();
builder.Services.AddSingleton<IQueryBus, InMemoryQueryBus>();
builder.Services.AddSingleton<IEventBus, OutboxEventBus>();
builder.Services.AddSingleton<ITransactionManager, EfTransactionManager>();
builder.Services.AddSingleton<IPolicyEvaluator, FoundationPolicyEvaluator>();
builder.Services.AddSingleton<IIdempotencyStore, PostgresIdempotencyStore>();
builder.Services.AddSingleton<ILockManager, RedisLockManager>();
builder.Services.AddSingleton<ICacheStore, RedisCacheStore>();
builder.Services.AddSingleton<IQueue, ChannelsQueueAdapter>();
builder.Services.AddSingleton<ISecretManager, ConfigurationSecretManager>();

builder.Services.AddIdentityModule();
builder.Services.AddAccessModule();
builder.Services.AddAuditModule();
```

```csharp
// Modules/Identity/ModuleIdentity.cs
public static class ModuleIdentity
{
    public static IServiceCollection AddIdentityModule(this IServiceCollection services)
    {
        services.AddScoped<IUserRepository, EfUserRepository>();
        services.AddScoped<ICommandHandler<RegisterUserCommand, RegisterUserResult>, RegisterUserHandler>();
        return services;
    }
}
```

Module registration extensions expose public contracts and handlers only. Private infrastructure stays inside the module assembly or namespace.

## Feature Slice Walkthrough

Command: register a user. The slice owns validation, policy, domain work, and result mapping.

```csharp
// Application/Features/RegisterUser/RegisterUserHandler.cs
public sealed class RegisterUserHandler
    : ICommandHandler<RegisterUserCommand, RegisterUserResult>
{
    private readonly IUserRepository _users;
    private readonly IEventBus _events;
    private readonly ITransactionManager _tx;

    public RegisterUserHandler(IUserRepository users, IEventBus events, ITransactionManager tx)
        => (_users, _events, _tx) = (users, events, tx);

    public async Task<RegisterUserResult> HandleAsync(RegisterUserCommand command, CancellationToken ct)
    {
        return await _tx.WithinTransactionAsync(async token =>
        {
            var user = User.Register(Email.From(command.Email), PasswordHash.From(command.PasswordHash));
            await _users.SaveAsync(user, 0, token);

            foreach (var domainEvent in user.PullDomainEvents())
            {
                await _events.PublishAsync(domainEvent, token);
            }

            return new RegisterUserResult(user.Id, user.Email);
        }, ct);
    }
}
```

```csharp
// Api/RegisterUserEndpoint.cs
app.MapPost("/api/v1/identity/users", async (
    RegisterUserRequest request,
    ICommandBus bus,
    IPolicyEvaluator policy,
    Actor actor,
    CancellationToken ct) =>
{
    if (!await policy.CanAsync(actor, "identity.user.create", null, ct))
        return Results.Problem(statusCode: StatusCodes.Status403Forbidden);

    var result = await bus.DispatchAsync<RegisterUserResult>(
        new RegisterUserCommand(request.Email, request.PasswordHash), ct);

    return Results.Created($"/api/v1/identity/users/{result.UserId}", result);
});
```

Checklist for every slice:

- one use case per folder;
- validator on input contract;
- policy check even if authorization middleware already ran;
- repository and event ports only;
- returns a result DTO, not an EF entity or domain aggregate;
- unit test without HTTP or database.

## HTTP Adapter Notes

- Endpoints map request DTOs to commands/queries and results to response DTOs.
- FluentValidation (or equivalent) runs at every untrusted boundary.
- RFC 9457 Problem Details is the public error contract.
- Authentication middleware establishes `Actor`; features still call `IPolicyEvaluator`.
- Never return EF Core entities from endpoints.

## Persistence Adapter Notes

- One schema per module where the database allows it.
- EF Core entity types live only under `Infrastructure/Persistence`.
- Repositories load/save aggregates only; list screens use query models or projections.
- Optimistic concurrency uses an expected version on save (or rowversion mapped to the port).
- Outbox rows insert in the same transaction as the state change.
- Avoid sharing one `DbContext` model across module private boundaries; split contexts or model configurations per module.

```csharp
// Infrastructure/Persistence/EfUserRepository.cs
public async Task SaveAsync(User aggregate, int expectedVersion, CancellationToken ct)
{
    var entry = _db.Entry(aggregate.ToPersistence());
    entry.Property("Version").OriginalValue = expectedVersion;

    try
    {
        await _db.SaveChangesAsync(ct);
    }
    catch (DbUpdateConcurrencyException)
    {
        throw new ConcurrencyConflictException();
    }
}
```

## Events, Queue, and Workers

- Domain events stay in-process inside the module use case.
- Integration events are written to outbox, then published by a hosted relay.
- `BackgroundService` / `IHostedService` workers must be idempotent.
- Consumers use inbox/idempotency records; the broker redelivers.

```csharp
// good: durable, transactional
await _tx.WithinTransactionAsync(async token =>
{
    await _users.SaveAsync(user, expectedVersion, token);
    _outbox.Enqueue(UserRegisteredV1.From(user));
    return true;
}, ct);

// wrong: best-effort side effect outside the state change
await _users.SaveAsync(user, expectedVersion, ct);
await _queue.EnqueueAsync("send-welcome-email", new { user.Id }, ct);
```

Do not treat in-memory `IMediator`/event notification as the durable integration backbone without outbox.

## Boundary Enforcement in Tooling

Project references (or analyzers) must encode module privacy.

```xml
<!-- Modules/Identity/Application/Identity.Application.csproj -->
<ItemGroup>
  <ProjectReference Include="..\Domain\Identity.Domain.csproj" />
  <ProjectReference Include="..\..\..\Kernel\Contracts\Kernel.Contracts.csproj" />
  <ProjectReference Include="..\Public\Identity.Public.csproj" />
</ItemGroup>
```

Enforcement options:

- one project per module layer (Domain, Application, Infrastructure, Api, Public);
- `NetArchTest` / `ArchUnitNET` architecture tests in CI;
- forbid `Microsoft.EntityFrameworkCore`, `Microsoft.AspNetCore.*` in Domain and Application projects;
- allow cross-module references only to `*.Public`;
- treat warnings as errors for illegal `using` / `PackageReference`.

Pseudo-rule:

```txt
from Modules.A -> Modules.B:
  allow B.Public/**
  deny  B.Domain/** B.Application/** B.Infrastructure/** B.Api/**

from Domain and Application:
  deny Microsoft.EntityFrameworkCore Microsoft.AspNetCore.* broker SDKs
```

## Testing

| Layer | Approach |
|---|---|
| domain | pure xUnit/NUnit unit tests |
| application | unit tests with in-memory ports |
| infrastructure | integration tests against real Postgres/Redis |
| api | WebApplicationFactory endpoint tests |
| architecture | NetArchTest/ArchUnitNET in CI |
| workers | idempotency and redelivery tests |

Application tests should pass without `WebApplicationFactory` or a real database.

## Trade-offs

- Project-per-layer boundaries are strong, but they add csproj ceremony.
- Explicit ports keep domain code portable, but they add indirection over a pure ASP.NET Core app.
- Outbox and inbox improve reliability, but they require hosted workers and visibility.
- EF Core is productive, but leaking entities across boundaries is the most common failure.
- Architecture tests have CI cost, but they make module privacy enforceable.

## Common Mistakes

- Referencing EF Core entities from API contracts.
- Returning `IQueryable` across module lines.
- Skipping policy checks because ASP.NET authorization already ran.
- Publishing bus messages outside the transaction that changed state.
- Sharing one DbContext model for every module’s private tables.
- Putting domain logic in controllers or minimal API handlers.
- Using MediatR pipeline behaviors as a hidden second domain layer.

## Verification

- [ ] Do project references point inward toward domain/application contracts?
- [ ] Are EF Core entities hidden from public API contracts?
- [ ] Are integration events published through outbox?
- [ ] Are background workers idempotent?
- [ ] Is every untrusted input validated at the boundary?
- [ ] Are outbox rows written in the same transaction as state changes?
- [ ] Do domain and application projects stay free of ASP.NET Core and EF Core?
- [ ] Does each module declare exports/imports in `module.manifest.yml`?
- [ ] Are endpoints mapping DTOs instead of returning domain entities?
- [ ] Are NetArchTest/ArchUnitNET rules running in CI?
