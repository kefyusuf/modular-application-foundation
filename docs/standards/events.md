# Event Standard

## Purpose

Define event naming, versioning, envelope, publishing, consuming, retry, and replay rules.

## Event Types

```txt
DomainEvent
IntegrationEvent
EventSourcedEvent
```

## Naming

```txt
{bounded_context}.{aggregate_or_resource}.{past_tense_fact}.v{number}
```

Examples:

```txt
identity.user.registered.v1
access.role.assigned.v1
audit.security_event.recorded.v1
```

## Envelope Required Fields

```txt
specversion
id
source
type
subject
time
datacontenttype
data
```

Recommended metadata:

```txt
correlationid
causationid
tenantid
actorid
traceparent
```

## Publishing Rule

Integration events must be written to outbox inside the same transaction as the state change.

## Consuming Rule

Consumers must use inbox-based idempotency.

## Retry Policy

Default:

```yml
retry:
  max_attempts: 5
  strategy: exponential
  jitter: true
  dead_letter_after: true
```

## Dead Letter Rule

A message goes to dead letter when:

- max attempts exceeded;
- event schema invalid;
- consumer cannot process after retry;
- poison message detected.

## Replay Rule

During replay:

- external side effects are disabled;
- emails/SMS/webhooks are not sent;
- projections may be rebuilt;
- audit replay must be marked as replay, not original action.

## Verification Checklist

- [ ] Event is a fact, not a command.
- [ ] Event is past tense.
- [ ] Event is versioned.
- [ ] Event schema exists.
- [ ] Producer uses outbox.
- [ ] Consumer uses inbox.
- [ ] Replay behavior is safe.
