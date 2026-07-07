# Kernel Contract: Idempotency Store

## Purpose

Stores idempotency records for retry-safe commands, HTTP operations, and event consumers.

## Responsibility

The idempotency store prevents duplicate side effects by recording request hashes, command IDs, consumer event IDs, and completed results.

## Inputs

- Idempotency key.
- Actor/scope.
- Request hash.
- Operation state.
- Expiry.

## Outputs

- Existing idempotency record.
- Lock/acquire result.
- Stored response metadata.
- Conflict result.

## Pseudocode

```txt
interface IdempotencyStore {
  begin(key, scope, requestHash, expiresAt): IdempotencyDecision
  complete(key, responseMetadata): void
  fail(key, errorMetadata): void
  seen(consumerName, eventId): boolean
  markSeen(consumerName, eventId): void
}
```

## Rules

- Same key and same request hash returns the previous result.
- Same key and different request hash returns conflict.
- Consumer idempotency must be durable.
- Sensitive stored responses must be minimized or encrypted.
- Records must expire according to operation risk.

## Common Adapters

- SQL table with unique keys.
- Redis with durable fallback for low-risk operations.
- Inbox table for event consumers.
- Command log table.

## Failure Modes

- Duplicate key conflict.
- In-progress operation timeout.
- Expired key reused too soon.
- Non-durable consumer dedupe.
- Sensitive response stored in plain text.

## Verification Checklist

- [ ] Is the idempotency scope actor-aware or tenant-aware?
- [ ] Is request hash compared?
- [ ] Are duplicate events harmless?
- [ ] Are records durable enough for retry windows?
- [ ] Are sensitive responses minimized?
