# Concurrency Standard

## Purpose

Prevent race conditions and inconsistent state under concurrent requests, workers, retries, and event processing.

## Baseline Rules

- Use optimistic concurrency for aggregate updates by default.
- Use locks only for short critical sections with clear ownership and timeout.
- Combine idempotency with concurrency controls for retryable operations.
- Define queue ordering for workflows where ordering affects correctness.
- Avoid cross-module transactions unless the modules share the same explicit consistency boundary.
- Use constraints, append-only movements, or version checks for ledger, inventory, and payment state.
- Every retry path must be safe under duplicate delivery.

## Strategy Matrix

| Problem | Strategy |
|---|---|
| duplicate API retry | idempotency key |
| concurrent aggregate update | optimistic version check |
| critical section | lock/advisory lock/distributed lock |
| duplicate event delivery | inbox idempotency |
| cross-module workflow | saga/process manager |
| inventory/ledger movement | append-only movement + constraints |

## Default Rule

Use optimistic concurrency first.

Use locks only for short critical sections with clear ownership and timeout.

## Queue Ordering

FIFO is required for:

- per-aggregate event stream;
- payment state transitions;
- ledger entries;
- inventory movements;
- saga steps.

LIFO should not be used for domain events or critical business workflows.

## Common Mistakes

- Adding locks before modeling ownership and version checks.
- Holding locks while calling external services.
- Assuming queue ordering is global when it is only per partition or key.
- Retrying failed writes without idempotency.
- Updating aggregate state without checking expected version.
- Using timestamps as the only conflict detection mechanism.
- Treating duplicate messages as rare instead of expected.

## Verification Checklist

- [ ] Does aggregate write check version?
- [ ] Are retries safe?
- [ ] Are locks bounded by timeout?
- [ ] Is queue ordering defined where needed?
- [ ] Are duplicate messages safe?
