# Kernel Contract: Repository

## Purpose

Persists and loads aggregates owned by one module.

## Responsibility

A repository protects aggregate persistence without becoming a generic query layer or cross-module data access shortcut.

## Inputs

- Aggregate identifier.
- Aggregate instance.
- Expected version.
- Transaction context.

## Outputs

- Loaded aggregate.
- Saved aggregate version.
- Not found or concurrency error.

## Pseudocode

```txt
interface Repository<TAggregate> {
  get(id): TAggregate
  save(aggregate, expectedVersion): SaveResult
}
```

## Rules

- Repositories are for aggregate persistence.
- Reporting and list screens use query services or projections.
- A module must not use another module's private repository.
- Saves should enforce optimistic concurrency where the aggregate has versioned state.

## Common Adapters

- SQL repository.
- ORM aggregate repository.
- Event-sourced repository.
- In-memory test repository.

## Failure Modes

- Aggregate not found.
- Optimistic concurrency conflict.
- Transaction unavailable.
- Private cross-module repository access.
- Query use case forced through aggregate loading.

## Verification Checklist

- [ ] Does the repository belong to one module?
- [ ] Does it persist aggregates, not arbitrary reports?
- [ ] Is expected version checked where needed?
- [ ] Are read models separate from aggregate repositories?
- [ ] Are other modules blocked from importing it?
