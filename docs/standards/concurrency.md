# Concurrency Standard

## Purpose

Prevent race conditions and inconsistent state under concurrent requests, workers, retries, and event processing.

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

## Verification Checklist

- [ ] Does aggregate write check version?
- [ ] Are retries safe?
- [ ] Are locks bounded by timeout?
- [ ] Is queue ordering defined where needed?
- [ ] Are duplicate messages safe?
