# Module Boundaries

## Purpose

Module boundaries prevent a modular monolith from becoming a distributed-looking big ball of mud.

Boundaries define what a module owns, what it publishes, and how other modules are allowed to depend on it.

## Golden Rule

A module may only expose what it explicitly publishes under `public/` or its `module.manifest.yml`.

Everything else is private.

## When to Use

Use explicit module boundaries when:

- more than one business capability exists in the same deployable application;
- a module owns data that other modules need to read or react to;
- permissions, events, or API contracts must be reviewed by module owner;
- a future extraction path should remain possible;
- the team needs architecture tests to detect forbidden dependencies.

## When Not to Use

Do not add heavy boundary machinery when:

- the code is a tiny prototype with one capability;
- there is no stable domain language yet;
- the team cannot maintain manifests, contracts, or architecture tests;
- the boundary only mirrors technical layers and not business ownership.

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

## Trade-offs

- Strict boundaries reduce coupling, but they make some simple calls more explicit.
- Public contracts improve reviewability, but they require versioning and compatibility discipline.
- Events reduce direct dependency, but they introduce idempotency and eventual consistency concerns.
- Module manifests clarify ownership, but stale manifests become misleading.
- Architecture tests catch drift, but they must be adapted per language and framework.

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
- [ ] Are read models or public contracts used instead of private table reads?
- [ ] Can forbidden imports be detected by a future architecture test?
