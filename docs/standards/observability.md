# Observability Standard

## Purpose

Make the system inspectable during development, production operation, incidents, and audits.

## Signals

```txt
logs
metrics
traces
audit logs
security events
business metrics
```

## Required Context

Each request, command, event, and job should carry:

```txt
request_id
correlation_id
causation_id
actor_id
tenant_id
module
feature
command_id
event_id optional
traceparent optional
```

## Metrics

Track:

- API latency;
- error rate;
- auth failures;
- permission denials;
- rate-limit blocks;
- DB query latency;
- cache hit/miss;
- queue lag;
- outbox lag;
- inbox duplicates;
- dead-letter count;
- saga failures;
- projection rebuild duration.

## Logging Rules

- logs must be structured;
- no secrets in logs;
- sensitive fields must be masked;
- logs must include correlation context;
- audit logs must be separate from debug logs.

## Verification Checklist

- [ ] Can a request be traced across command/event/job?
- [ ] Are errors correlated to request IDs?
- [ ] Are queue failures visible?
- [ ] Are outbox and saga delays measurable?
- [ ] Are secrets masked?
