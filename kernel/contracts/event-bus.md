# Kernel Contract: Event Bus

## Purpose

Publishes and routes domain and integration events.

## Responsibility

The event bus delivers facts to subscribers while preserving versioning, idempotency, ordering requirements, and replay safety.

## Inputs

- Event type.
- Event payload.
- Event metadata.
- Subscriber registration.

## Outputs

- Published domain events.
- Published integration events.
- Subscriber execution result.
- Dead-letter or retry signal.

## Pseudocode

```txt
interface EventBus {
  publish(event): void
  subscribe(eventType, handler): void
}

interface Event {
  id(): EventId
  type(): EventType
  version(): EventVersion
  occurredAt(): Timestamp
  metadata(): EventMetadata
  data(): object
}
```

## Rules

- Domain events may be synchronous inside a module.
- Integration events must go through outbox.
- Consumers must be idempotent.
- Events must be facts, not commands.
- Event payloads must be public contracts.

## Common Adapters

- In-process event dispatcher.
- Outbox publisher.
- Queue or broker consumer.
- Projection rebuild dispatcher.

## Failure Modes

- Event schema validation failure.
- Outbox publish failure.
- Duplicate delivery.
- Consumer retry exhaustion.
- Replay triggers external side effects.

## Verification Checklist

- [ ] Is the event name past tense and versioned?
- [ ] Is integration publishing backed by outbox?
- [ ] Is consuming backed by inbox/idempotency?
- [ ] Are retries and dead letters defined?
- [ ] Are replay side effects disabled?
