# Event-Driven Architecture

## Purpose

Events allow modules to react to facts without hardcoded coupling.

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
