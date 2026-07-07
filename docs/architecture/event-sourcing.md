# Event Sourcing

## Purpose

Event sourcing stores state transitions as an append-only event stream and rebuilds aggregate state from events.

## When to Use

Use event sourcing for:

- ledger;
- wallet;
- payment lifecycle;
- inventory movement;
- audit-heavy workflows;
- critical state machines.

## When Not to Use

Avoid event sourcing for:

- simple CRUD;
- user profile basics;
- CMS pages;
- settings;
- low-value admin tables;
- teams without replay/testing discipline.

## Event Store Shape

```txt
event_store
  stream_id
  stream_type
  version
  event_id
  event_type
  event_version
  payload
  metadata
  occurred_at
```

## Optimistic Concurrency

Append must use expected version:

```txt
append(stream_id, expected_version, new_events)
```

If expected version does not match current stream version, reject and retry/reload.

## Common Mistakes

- Treating integration events and event-sourced events as the same thing.
- Replaying events that trigger external side effects.
- Not versioning event payloads.
- Not planning projection rebuilds.
- Using event sourcing everywhere.

## Verification Checklist

- [ ] Are events immutable?
- [ ] Is stream version checked?
- [ ] Are projections rebuildable?
- [ ] Are upcasters planned?
- [ ] Are replay side effects disabled?
