# Kernel Contract: Lock Manager

## Purpose

Coordinates short critical sections where optimistic concurrency is not enough.

## Responsibility

The lock manager acquires, renews, and releases bounded locks for a clearly owned resource.

## Inputs

- Lock key.
- Owner token.
- Timeout.
- Lease duration.
- Correlation context.

## Outputs

- Lock acquisition result.
- Renewal result.
- Release result.

## Pseudocode

```txt
interface LockManager {
  acquire(key, owner, ttl): LockResult
  renew(lock, ttl): LockResult
  release(lock): void
}
```

## Rules

- Prefer optimistic concurrency before locks.
- Locks must have TTL.
- Lock keys must include module and resource ownership.
- Do not hold locks while calling external services.
- Failed releases must be observable.

## Common Adapters

- Database advisory lock.
- Redis lock.
- Queue partition ownership.
- In-process lock for single-node tests only.

## Failure Modes

- Lock timeout.
- Split ownership.
- Stale lock.
- Lock released by wrong owner.
- External call blocks lock release.

## Verification Checklist

- [ ] Is optimistic concurrency insufficient and documented?
- [ ] Does every lock have TTL?
- [ ] Is the owner token checked on release?
- [ ] Are lock waits bounded?
- [ ] Are lock failures logged with correlation context?
