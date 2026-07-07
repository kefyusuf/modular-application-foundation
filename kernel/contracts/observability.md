# Kernel Contract: Observability

## Purpose

Provides framework-neutral logging, metrics, tracing, and audit/event correlation hooks.

## Responsibility

Observability preserves request, command, event, job, actor, tenant, and module context across execution boundaries.

## Inputs

- Log event.
- Metric measurement.
- Trace span.
- Correlation context.
- Error details.

## Outputs

- Structured log record.
- Metric point.
- Trace span.
- Alert or diagnostic signal.

## Pseudocode

```txt
interface Observability {
  log(level, message, context): void
  metric(name, value, tags): void
  trace(name, context, callback): Result
  error(error, context): void
}
```

## Rules

- Logs must be structured.
- Secrets and sensitive fields must be masked.
- Correlation ID must flow through commands, events, and jobs.
- Audit logs are separate from debug logs.
- Use standard semantic names where practical.

## Common Adapters

- OpenTelemetry tracer.
- Structured logger.
- Metrics backend.
- Error reporting service.
- Audit event bridge.

## Failure Modes

- Missing correlation context.
- Secret value logged.
- High-cardinality metric tags.
- Trace context lost across queues.
- Audit and debug logs mixed together.

## Verification Checklist

- [ ] Can a request be traced across command/event/job?
- [ ] Are secrets masked?
- [ ] Are module and feature tags present?
- [ ] Are outbox, inbox, and queue delays observable?
- [ ] Are audit records separate from runtime logs?
