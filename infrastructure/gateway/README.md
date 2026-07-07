# Gateway Guidance

## Purpose

Define how reverse proxies and API gateways should support modular applications without replacing application-level security or contracts.

The gateway is an edge adapter. It handles transport concerns and forwards requests to application interfaces.

## Baseline Rules

- Gateways may enforce TLS, routing, request size limits, rate limits, CORS policy, and coarse authentication integration.
- Object-level authorization must remain inside the application policy layer.
- Gateway routes must align with published API contracts.
- Gateway configuration must not expose private module internals.
- Correlation and trace headers must be preserved.
- Request and response transformations must not silently change public contracts.
- Gateway policies must be tested as part of release readiness when they affect behavior.

## Responsibilities

Appropriate gateway responsibilities:

```txt
TLS termination
host and path routing
request size limits
rate limiting
CORS enforcement
coarse authentication handoff
header normalization
trace header propagation
edge access logs
```

Application responsibilities:

```txt
use case authorization
object-level authorization
tenant ownership checks
business validation
idempotency decisions
contract DTO mapping
audit event creation
```

## Routing Guidance

Routes should be contract-aligned:

```txt
/api/v1/identity/me
/api/v1/access/roles
/api/v1/audit/events
```

Avoid routes that expose internal layers:

```txt
/identity/infrastructure/users
/audit/database/audit_logs
/access/repositories/roles
```

## Security Guidance

Gateway security can reduce exposure, but it is not the complete security model.

Use the gateway for:

- TLS;
- request limits;
- coarse rate limits;
- CORS;
- known bad request blocking;
- forwarding verified identity context where supported.

Keep in application:

- permission checks;
- ABAC context evaluation;
- tenant ownership checks;
- business rule validation;
- audit log decisions.

## Common Mistakes

- Moving object-level authorization into gateway rules.
- Letting gateway transformations drift from OpenAPI contracts.
- Hiding private module endpoints behind edge routing.
- Dropping correlation or trace headers.
- Assuming gateway rate limits replace application idempotency.
- Treating gateway config as untestable infrastructure glue.

## Verification Checklist

- [ ] Do gateway routes match public API contracts?
- [ ] Are private module internals hidden from edge routing?
- [ ] Are correlation and trace headers preserved?
- [ ] Is object-level authorization still enforced by application policies?
- [ ] Are request size, CORS, and rate-limit rules documented?
- [ ] Are gateway behavior changes tested before release?
