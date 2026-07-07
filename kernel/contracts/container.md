# Kernel Contract: Container

## Purpose

Resolves dependencies and binds public capabilities.

## Responsibility

The container wires interfaces to implementations without allowing modules to depend on private internals of other modules.

## Inputs

- Service or capability identifier.
- Implementation factory.
- Lifetime/scope metadata.
- Module registration context.

## Outputs

- Resolved service instance.
- Registration errors.
- Dependency graph diagnostics.

## Pseudocode

```txt
interface Container {
  bind(identifier, factory, options): void
  resolve(identifier): object
  has(identifier): boolean
}
```

## Rules

- Bind public contracts and kernel capabilities, not private classes.
- Prefer constructor dependencies over global lookups.
- Detect circular dependencies during registration.
- Module registration must not override another module's private binding.

## Common Adapters

- Framework dependency injection container.
- Manual composition root.
- Service locator wrapper limited to bootstrapping.

## Failure Modes

- Missing binding.
- Duplicate binding.
- Circular dependency.
- Wrong lifetime scope.
- Private implementation exposed as public contract.

## Verification Checklist

- [ ] Are bindings named by public contract or capability?
- [ ] Are private module classes hidden?
- [ ] Are circular dependencies detected?
- [ ] Is lifetime/scope explicit where needed?
- [ ] Can tests replace adapters with fakes?
