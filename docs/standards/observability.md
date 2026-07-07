# Observability Standard

## Purpose

Make the system inspectable during development, production operation, incidents, and audits.

## Baseline Rules

- Use structured logs, metrics, and traces for runtime observability.
- Use audit logs and security events for accountability, not debugging.
- Propagate request, correlation, causation, actor, tenant, module, and feature context.
- Align telemetry naming with OpenTelemetry semantic conventions where practical.
- Record outbox, inbox, queue, saga, projection, and dead-letter health.
- Mask secrets and sensitive values before logging or tracing.
- Define business metrics for critical workflows, not only infrastructure metrics.

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

## Common Mistakes

- Logging strings that cannot be queried reliably.
- Treating audit logs as application debug logs.
- Dropping correlation IDs when moving from HTTP to command, event, or job.
- Logging tokens, reset links, passwords, or secret values.
- Measuring only API latency while queues, outbox, and projections are invisible.
- Creating custom telemetry names when standard conventions already exist.
- Alerting on every error without tying alerts to user or business impact.

## Verification Checklist

- [ ] Can a request be traced across command/event/job?
- [ ] Are errors correlated to request IDs?
- [ ] Are queue failures visible?
- [ ] Are outbox and saga delays measurable?
- [ ] Are secrets masked?
