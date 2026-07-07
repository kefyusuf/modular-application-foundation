# Idempotency Standard

## Purpose

Idempotency prevents duplicate side effects when clients, workers, or brokers retry operations.

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

## Verification Checklist

- [ ] Are payment-like operations idempotent?
- [ ] Are POST retries safe where required?
- [ ] Are consumers idempotent?
- [ ] Are duplicate events harmless?
- [ ] Are request hashes compared?
