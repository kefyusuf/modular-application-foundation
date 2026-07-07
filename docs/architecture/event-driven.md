# Event-Driven Architecture

## Purpose

Events allow modules to react to facts without hardcoded coupling.

In this foundation, events are integration contracts. They should be treated with the same care as public APIs.

## When to Use

Use events when:

- another module needs to react to a completed business fact;
- the publisher should not know all downstream consumers;
- side effects can happen asynchronously;
- a read model or projection needs to be updated after a state change;
- cross-system integration should avoid direct private data access.

## When Not to Use

Do not use events when:

- the caller needs an immediate answer;
- the operation must be part of the same consistency boundary;
- the event would only hide a synchronous RPC call;
- consumers are not idempotent;
- the event name or schema is not stable enough to publish.

## Event Types

| Type | Scope | Purpose |
|---|---|---|
| Domain Event | inside one module | express domain facts |
| Integration Event | across modules/systems | publish stable external facts |
| Event-Sourced Event | aggregate event stream | rebuild aggregate state |

## Event Naming

```txt
{domain}.{entity_or_capability}.{past_tense_fact}.v{version}
```

Examples:

```txt
identity.user.registered.v1
order.order.paid.v1
payment.payment.failed.v1
```

## Envelope

Use a CloudEvents-style envelope.

```json
{
  "specversion": "1.0",
  "id": "evt_01J...",
  "source": "mod://identity",
  "type": "identity.user.registered.v1",
  "subject": "user/usr_123",
  "time": "2026-07-06T12:00:00Z",
  "datacontenttype": "application/json",
  "correlationid": "corr_123",
  "causationid": "cmd_123",
  "data": {}
}
```

## Outbox Rule

Any integration event produced by a business transaction must be saved in the same transaction as the state change.

## Inbox Rule

Every consumer must be idempotent.

## Trade-offs

- Events reduce direct coupling, but they introduce eventual consistency.
- Publishers can stay simple, but consumers need idempotency, retries, and observability.
- Event contracts support future extraction, but breaking changes must be versioned.
- Outbox/inbox patterns improve reliability, but they add storage and processing complexity.
- Events are useful for integration, but they should not replace clear command/query APIs.

## Common Mistakes

- Publishing events before transaction commit.
- Using events as synchronous RPC.
- Publishing unversioned events.
- Replaying events that send emails again.
- Assuming exactly-once delivery without idempotency.

## Verification Checklist

- [ ] Is the event name past tense?
- [ ] Is the event versioned?
- [ ] Is the event published through outbox?
- [ ] Is the consumer idempotent?
- [ ] Can side effects be disabled during replay?
- [ ] Is the event a fact rather than a command?
- [ ] Is the payload a public contract instead of a private entity dump?
