# Kernel Contract: Transaction Manager

## Purpose

Defines state-change transaction boundaries.

## Responsibility

The transaction manager executes a unit of work atomically and coordinates state changes with outbox records when integration events are produced.

## Inputs

- Unit of work callback.
- Transaction options.
- Correlation context.

## Outputs

- Callback result.
- Commit result.
- Rollback error.

## Pseudocode

```txt
interface TransactionManager {
  withinTransaction(options, callback): Result
}
```

## Rules

- Transactions must be short-lived.
- External API calls should not happen inside a database transaction.
- Integration events must be stored in outbox within the same transaction as the state change.
- Cross-module transactions are forbidden unless explicitly approved by architecture decision.

## Common Adapters

- SQL database transaction.
- Unit of work wrapper.
- ORM transaction adapter.
- Outbox-aware transaction decorator.

## Failure Modes

- Deadlock.
- Timeout.
- Rollback after partial external side effect.
- Outbox write failure.
- Cross-module ownership violation.

## Verification Checklist

- [ ] Is the transaction boundary explicit?
- [ ] Are external side effects outside the transaction?
- [ ] Are outbox records written atomically with state changes?
- [ ] Are rollback errors observable?
- [ ] Are cross-module writes avoided?
