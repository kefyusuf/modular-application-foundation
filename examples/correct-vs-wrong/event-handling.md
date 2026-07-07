# Correct vs Wrong: Event Handling

## Wrong

```txt
identity publishes UserRegistered before database commit
notification sends welcome email directly during event replay
consumer assumes exactly-once delivery
event type is user.created
```

Why it is wrong:

- Events can be published for rolled-back state.
- Replay can trigger external side effects.
- Duplicate delivery is normal in distributed messaging.
- Unversioned event names are hard to evolve.

## Correct: Outbox Publishing

```txt
transaction {
  identity.users.insert(user)
  outbox.insert(identity.user.registered.v1, payload, metadata)
}

outbox publisher sends event after commit
```

Integration events must be written in the same transaction as the state change.

## Correct: Inbox Consuming

```txt
if inbox.seen("notification", event.id) {
  return already_processed
}

notification.enqueueWelcomeEmail(event.data.user_id)
inbox.markSeen("notification", event.id)
```

Consumers must be idempotent.

## Correct: Replay Safety

```txt
replay mode:
  rebuild projections
  skip email/SMS/webhook side effects
  mark audit entries as replayed if emitted
```

Replay should rebuild state and projections without repeating external side effects.

## Verification

- [ ] Is the event a past-tense fact?
- [ ] Is the event versioned?
- [ ] Does the producer use outbox?
- [ ] Does the consumer use inbox/idempotency?
- [ ] Are replay side effects disabled?
