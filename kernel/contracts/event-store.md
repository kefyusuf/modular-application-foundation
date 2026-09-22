# Kernel Contract: Event Store

## Purpose

Appends and loads event-sourced streams for aggregates that rebuild state from immutable events.

## Responsibility

The event store is the durable, append-only source of truth for event-sourced aggregates. It is not a message broker and does not replace the event bus or outbox.

## Inputs

- Stream identifier and stream type.
- Expected stream version.
- New events to append.
- Event metadata.
- Read options: stream position, limit, snapshot reference.

## Outputs

- Append result with new stream version.
- Loaded event stream or slice.
- Concurrency conflict when expected version does not match.
- Not found when the stream does not exist.

## Pseudocode

```txt
interface EventStore {
  append(streamId, expectedVersion, newEvents): AppendResult
  load(streamId, fromVersion?, maxCount?): EventStreamSlice
  loadAll(fromPosition?, maxCount?): EventStreamSlice
  streamVersion(streamId): Version
}

interface StoredEvent {
  eventId(): EventId
  streamId(): StreamId
  streamVersion(): Version
  eventType(): EventType
  eventVersion(): EventVersion
  payload(): object
  metadata(): EventMetadata
  occurredAt(): Timestamp
}
```

## Rules

- Event-sourced events are immutable once appended.
- Append must use optimistic concurrency through expected version.
- Event-sourced stream events are separate from integration events on the bus.
- Replay must not trigger external side effects unless explicitly designed and gated.
- Snapshots are optional performance caches; the stream remains the source of truth.
- Event payloads in the stream are internal module history, not public contracts.
- Only the owning module may load or append its streams.

## Common Adapters

- SQL append-only event table.
- Specialized event database.
- In-memory test event store.
- Snapshot-aware event store decorator.

## Failure Modes

- Optimistic concurrency conflict on append.
- Stream not found.
- Unknown event type during load or replay.
- Missing upcaster for an old event version.
- Replay invokes external side effects.
- Cross-module stream access.

## Verification Checklist

- [ ] Is the stream owned by exactly one module?
- [ ] Is expected version enforced on append?
- [ ] Are events immutable after append?
- [ ] Are event-sourced events kept separate from integration events?
- [ ] Are upcasters planned for long-lived streams?
- [ ] Are replay side effects disabled?
