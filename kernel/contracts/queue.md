# Kernel Contract: Queue

## Purpose

Dispatches asynchronous jobs and messages to workers with retry and dead-letter behavior.

## Responsibility

The queue moves work that should not run inside the request path. It is not a domain event bus and does not replace outbox-backed integration events.

## Inputs

- Job or message type.
- Payload or command reference.
- Delivery options: delay, priority, dedupe key.
- Retry policy.
- Correlation and causation metadata.

## Outputs

- Enqueue result with job identifier.
- Claimed job for a worker.
- Ack, nack, or retry signal.
- Dead-letter record after retry exhaustion.

## Pseudocode

```txt
interface Queue {
  enqueue(job): EnqueueResult
  claim(workerName, options?): ClaimedJob
  ack(jobId): void
  nack(jobId, error, retry?): void
  deadLetter(jobId, error): void
}
```

## Rules

- Jobs must be idempotent because redelivery is expected.
- State changes that must be atomic with domain writes go through outbox, not a best-effort enqueue.
- The queue is infrastructure behind a port; domain code does not import broker SDKs.
- Retry and dead-letter rules must be defined before production use.
- Payloads must avoid private entities and secrets; prefer stable command contracts.
- Ordering guarantees, when required, must be explicit per queue or partition key.

## Common Adapters

- Redis-backed job queue.
- RabbitMQ or Kafka work queue.
- Cloud queue service.
- In-process test queue.

## Failure Modes

- Duplicate execution of a non-idempotent job.
- Lost job after process crash without durable claims.
- Retry storm or poison message.
- Enqueue outside the transaction that created the work item.
- Assuming global ordering from a partitioned broker.

## Verification Checklist

- [ ] Is the job handler idempotent?
- [ ] Are retry and dead-letter policies configured?
- [ ] Is durable state change paired with outbox rather than best-effort enqueue?
- [ ] Are correlation IDs preserved across workers?
- [ ] Are payload contracts public and versioned when they cross module lines?
