# Kernel Contract: Unit of Work

## Purpose

Tracks aggregate and persistence changes within one application use case and commits them as a single atomic boundary.

## Responsibility

The unit of work collects loads and saves started by a use case, then flushes or commits them together. It coordinates with the transaction manager but does not own the database transaction itself.

## Inputs

- Registered repositories or aggregate handles.
- Change set: inserts, updates, deletes, or pending events.
- Transaction context supplied by the transaction manager.
- Commit options.

## Outputs

- Tracked entities and aggregates.
- Commit result with affected counts or versions.
- Discard or rollback signal on failure.

## Pseudocode

```txt
interface UnitOfWork {
  register(repository): void
  track(aggregate): void
  commit(): CommitResult
  discard(): void
}
```

## Rules

- One unit of work per application use case or command handler scope.
- The unit of work does not open transactions on its own; the transaction manager defines the atomic boundary.
- Integration events and outbox records must be committed with the tracked state change.
- Cross-module change sets are forbidden unless an architecture decision allows a rare shared boundary.
- Reads for reports and projections do not belong in a unit of work.
- Discard must leave no partial side effects in the persistence layer.

## Common Adapters

- ORM unit of work.
- SQL flush coordinator.
- Outbox-aware unit of work decorator.
- In-memory test unit of work.

## Failure Modes

- Commit failure after partial flush.
- Forgotten track of an aggregate so changes are lost.
- Nested units of work with unclear ownership.
- State change committed without its outbox records.
- Cross-module dirty writes.

## Verification Checklist

- [ ] Is the unit of work scoped to one use case?
- [ ] Are all state changes tracked before commit?
- [ ] Does commit stay inside a transaction manager boundary?
- [ ] Are outbox records committed atomically with state?
- [ ] Are report and projection queries outside the unit of work?
- [ ] Does discard leave no partial writes?
