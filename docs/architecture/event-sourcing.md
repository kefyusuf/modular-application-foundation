# Event Sourcing

## Purpose

Event sourcing stores state transitions as an append-only event stream and rebuilds aggregate state from events.

It is an optional pattern for selected high-value workflows, not the default persistence model for every module.

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

## Trade-offs

- Event sourcing gives a complete history of decisions, but it increases model and operational complexity.
- Rebuilding state from events improves auditability, but projections and snapshots need lifecycle management.
- Optimistic concurrency protects streams, but conflict handling must be part of the application flow.
- Event versioning enables long-lived streams, but upcasters and migration policies must be planned.
- It can support critical state machines well, but using it for simple CRUD slows delivery without enough benefit.

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
- [ ] Is event sourcing justified by audit, reconstruction, or concurrency needs?
- [ ] Are integration events separated from event-sourced stream events?
