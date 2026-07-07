# Kernel Contract: Command Bus

## Purpose

Routes commands to command handlers.

## Pseudocode

```txt
interface CommandBus {
  dispatch(command): CommandResult
}
```

## Rules

- Commands represent intent.
- Commands should carry command ID and correlation ID.
- Handlers enforce validation and authorization.
- Unsafe commands should be idempotent where needed.
