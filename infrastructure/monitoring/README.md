# Monitoring Guidance

## Purpose

Define runtime monitoring guidance for modular applications that use logs, metrics, traces, audit logs, and security events.

Monitoring should make the system inspectable across HTTP requests, commands, events, queues, projections, and background jobs.

## Baseline Rules

- Use structured logs, metrics, and traces.
- Preserve request, correlation, causation, actor, tenant, module, and feature context.
- Keep audit logs separate from debug and operational logs.
- Mask secrets and sensitive values before logging or tracing.
- Monitor outbox lag, inbox duplicates, queue lag, dead-letter counts, projection rebuilds, and saga failures.
- Define service-level indicators for critical user and business workflows.
- Prefer OpenTelemetry-compatible instrumentation where practical.

## Required Signals

```txt
structured logs
metrics
distributed traces
audit logs
security events
business metrics
health checks
```

## Runtime Metrics

Track at minimum:

- API latency and error rate;
- authentication failures;
- permission denials;
- rate-limit blocks;
- database query latency;
- cache hit and miss rate;
- queue lag;
- outbox lag;
- inbox duplicate count;
- dead-letter count;
- projection rebuild duration;
- storage upload and download failures.

## Trace Context

Each request, command, event, and job should carry:

```txt
request_id
correlation_id
causation_id
actor_id
tenant_id
module
feature
traceparent
```

## Alerting Guidance

Alerts should be tied to user impact or operational risk.

Good alert candidates:

- sustained API error rate;
- rising queue or outbox lag;
- dead-letter growth;
- authentication attack signals;
- permission denial spikes;
- failed projection rebuilds;
- storage or database saturation.

Avoid alerting on every isolated error without context.

## Common Mistakes

- Logging unstructured strings that cannot be queried.
- Losing correlation IDs across async boundaries.
- Treating audit logs as debug logs.
- Monitoring API latency while queues and outbox are invisible.
- Exposing secrets in logs, traces, or labels.
- Creating alerts that cannot identify the failing module or workflow.

## Verification Checklist

- [ ] Can a request be traced through command, event, and job boundaries?
- [ ] Are queue, outbox, inbox, and projection failures visible?
- [ ] Are secrets masked in logs and traces?
- [ ] Are audit logs separate from operational logs?
- [ ] Do alerts include module and workflow context?
- [ ] Are critical business workflows represented by metrics?
