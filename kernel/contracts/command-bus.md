# Kernel Contract: Command Bus

## Purpose

Routes commands to command handlers.

## Responsibility

The command bus coordinates intent-based writes while keeping validation, authorization, idempotency, transactions, and side effects explicit.

## Inputs

- Command name.
- Command payload.
- Actor/context.
- Command ID.
- Correlation ID.

## Outputs

- Command result.
- Domain events or integration events.
- Validation, authorization, or conflict errors.

## Pseudocode

```txt
interface CommandBus {
  dispatch(command): CommandResult
}

interface Command {
  id(): CommandId
  name(): CommandName
  actor(): Actor
  correlationId(): CorrelationId
  payload(): object
}
```

## Rules

- Commands represent intent.
- Commands should carry command ID and correlation ID.
- Handlers enforce validation and authorization.
- Unsafe commands should be idempotent where needed.
- Transaction boundaries must be explicit for state-changing commands.

## Common Adapters

- In-process command dispatcher.
- Job queue command dispatcher.
- HTTP-to-command adapter.
- CLI-to-command adapter.

## Failure Modes

- No handler registered.
- Validation failure.
- Authorization denied.
- Idempotency conflict.
- Optimistic concurrency conflict.
- Transaction rollback.

## Verification Checklist

- [ ] Does every command have one owner module?
- [ ] Does every unsafe command carry command ID and correlation ID?
- [ ] Are validation and authorization enforced before state changes?
- [ ] Is idempotency defined for retryable commands?
- [ ] Are emitted events recorded after a successful state change?
