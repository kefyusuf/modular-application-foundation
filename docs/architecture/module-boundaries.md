# Module Boundaries

## Purpose

Module boundaries prevent a modular monolith from becoming a distributed-looking big ball of mud.

## Golden Rule

A module may only expose what it explicitly publishes under `public/` or its `module.manifest.yml`.

Everything else is private.

## Forbidden Examples

```txt
order -> identity.infrastructure.repositories.UserRepository
payment -> order.domain.entities.Order
notification -> access.database.roles table
billing -> tenant.internal.TenantResolver
```

## Correct Alternatives

```txt
order -> IdentityReader public contract
payment -> order.paid.v1 integration event
notification -> notification.send capability port
billing -> TenantContext provided by kernel
```

## Public Contract Types

```txt
public/contracts
public/dto
public/events
public/commands
public/queries
public/permissions
```

## Boundary Enforcement

Boundary rules should eventually be verified by architecture tests.

Pseudo-rule:

```txt
for each module:
  domain must not import any other module
  application may import own domain and public contracts only
  infrastructure must implement ports, not leak adapters
  interfaces must call application use cases, not repositories
```

## Common Mistakes

- Adding a `shared` folder that becomes a junk drawer.
- Sharing entity classes because it feels convenient.
- Adding cross-module foreign keys by default.
- Treating events as synchronous service calls.
- Letting admin panels bypass application services.

## Verification Checklist

- [ ] Can a module be understood by reading its manifest?
- [ ] Is every external dependency declared?
- [ ] Does every exported event have a version?
- [ ] Does every exported permission follow naming rules?
- [ ] Does any code example show private cross-module access?
