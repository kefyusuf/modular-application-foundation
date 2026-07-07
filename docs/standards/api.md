# API Standard

## Purpose

Define the API-first standard for public, admin, mobile, partner, and internal interfaces.

## Baseline Rules

- REST documented with OpenAPI is the primary public API style.
- Every endpoint must map to a module and capability.
- Request and response shapes must use DTOs or contracts, not private domain entities.
- Errors must follow RFC 9457 Problem Details.
- Unsafe retryable operations must define idempotency behavior.
- Authentication, object-level authorization, rate limits, and audit needs must be defined per operation.
- Public API changes must be reviewed for backward compatibility before implementation.

## API Priority

| Priority | API Type | Role |
|---:|---|---|
| 1 | REST/OpenAPI | primary public API |
| 2 | AsyncAPI/Event Contracts | message-driven integration |
| 3 | GraphQL | read aggregation/BFF scenarios |
| 4 | gRPC | internal high-performance service calls |
| 5 | Webhooks | outbound partner notifications |
| 6 | SSE/WebSocket | realtime updates |

## REST Path Standard

```txt
/api/v1/{module}/{resource}
```

Examples:

```txt
GET    /api/v1/identity/users
POST   /api/v1/identity/users
POST   /api/v1/identity/auth/login
POST   /api/v1/orders/{id}/cancel
```

## Request Headers

```txt
Authorization: Bearer <token>
Idempotency-Key: <client-generated-key>
X-Request-Id: <request-id>
X-Correlation-Id: <correlation-id>
```

## Success Response

```json
{
  "data": {},
  "meta": {
    "request_id": "req_123",
    "correlation_id": "corr_123"
  }
}
```

## Error Response

Use RFC 9457 Problem Details shape:

```json
{
  "type": "https://docs.example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "detail": "The request payload contains invalid fields.",
  "instance": "/api/v1/identity/users",
  "errors": {
    "email": ["Email is already used."]
  },
  "request_id": "req_123"
}
```

## Pagination

Recommended query parameters:

```txt
?page[number]=1&page[size]=25
```

or cursor:

```txt
?page[after]=cursor&page[size]=25
```

## Filtering and Sorting

```txt
?filter[status]=active&sort=-created_at,name
```

## API Versioning

Default:

```txt
/api/v1
```

Rules:

- breaking change requires new major version;
- additive fields are allowed;
- removing fields is breaking;
- changing enum value meaning is breaking;
- changing error shape is breaking.

## GraphQL Positioning

GraphQL should be used for read aggregation or BFF needs, not as the default replacement for all REST APIs.

## gRPC Positioning

gRPC is suitable for internal high-performance typed communication, streaming, and service-to-service calls after boundaries are stable.

## Common Mistakes

- Returning domain entities directly from controllers.
- Treating GraphQL as a default replacement for all REST APIs.
- Adding endpoints before module ownership is clear.
- Changing response or error shape without a versioning decision.
- Using HTTP status codes without machine-readable Problem Details.
- Skipping object-level authorization because route-level auth exists.
- Making idempotency optional for payment-like or retryable unsafe operations.

## Verification Checklist

- [ ] Does the endpoint map to a module and capability?
- [ ] Is it documented in OpenAPI?
- [ ] Are errors Problem Details compatible?
- [ ] Is authorization checked at object level?
- [ ] Is idempotency required for unsafe retryable operations?
