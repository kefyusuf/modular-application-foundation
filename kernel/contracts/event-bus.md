# Kernel Contract: Event Bus

## Purpose

Publishes and routes domain and integration events.

## Pseudocode

```txt
interface EventBus {
  publish(event): void
  subscribe(eventType, handler): void
}
```

## Rules

- Domain events may be synchronous inside a module.
- Integration events must go through outbox.
- Consumers must be idempotent.
