# Kernel Contract: Module

## Purpose

Defines the minimum behavior required from a module.

## Pseudocode

```txt
interface Module {
  name(): ModuleName
  manifest(): ModuleManifest
  register(container): void
  boot(kernel): void
  health(): ModuleHealth
}
```

## Rules

- Module registration binds public capabilities.
- Module boot must not import private internals of other modules.
- Module health should expose dependency readiness.
