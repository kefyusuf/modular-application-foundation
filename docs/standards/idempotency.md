# Idempotency Standard

## Purpose

Idempotency prevents duplicate side effects when clients, workers, or brokers retry operations.

## Baseline Rules

- Unsafe retryable HTTP operations must define whether they require an idempotency key.
- Idempotency records must bind key, actor, scope, request hash, state, and expiry.
- Same key with same request hash must return the previous result.
- Same key with different request hash must return conflict.
- Commands should carry command ID and correlation ID.
- Event consumers must keep an inbox record keyed by consumer and event ID.
- Idempotency storage must expire safely and protect sensitive stored responses.

## HTTP Idempotency

Unsafe retryable operations should accept:

```txt
Idempotency-Key: <client-generated-key>
```

Store:

```txt
key
actor_id
scope
request_hash
response_status
response_body
state
locked_until
expires_at
created_at
```

Rules:

- same key + same request hash returns previous response;
- same key + different request hash returns conflict;
- in-progress key returns conflict or accepted;
- keys expire after TTL;
- sensitive responses must be minimized or encrypted.

## Command Idempotency

Each command should include:

```txt
command_id
correlation_id
actor_id
```

## Event Consumer Idempotency

Use inbox:

```txt
unique(consumer_name, event_id)
```

## Common Mistakes

- Treating idempotency as a frontend-only retry feature.
- Accepting the same idempotency key for different request bodies.
- Storing sensitive full responses without encryption or minimization.
- Forgetting actor or tenant scope in the idempotency key.
- Making consumers idempotent in memory instead of durable storage.
- Retrying commands without command IDs or correlation IDs.
- Expiring keys too quickly for real client and worker retry windows.

## Verification Checklist

- [ ] Are payment-like operations idempotent?
- [ ] Are POST retries safe where required?
- [ ] Are consumers idempotent?
- [ ] Are duplicate events harmless?
- [ ] Are request hashes compared?
