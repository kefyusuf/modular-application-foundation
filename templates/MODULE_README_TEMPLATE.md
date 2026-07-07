# Module: {module-name}

## Purpose

Explain what this module owns.

Explain why this module exists separately from adjacent modules.

## Ownership

```txt
Business owner:
Technical owner:
Module type:
Lifecycle status:
```

## Boundary Summary

```txt
Public surface:
Private internals:
Allowed dependencies:
Forbidden dependencies:
```

## Responsibilities

- Responsibility 1.
- Responsibility 2.
- Responsibility 3.

## Non-Responsibilities

- What this module explicitly does not own.

## Public Contracts

```txt
public/contracts
public/commands
public/queries
public/events
public/permissions
```

Describe which contracts are stable and which are experimental.

## Domain Model

```txt
Aggregate
Entity
ValueObject
DomainService
DomainEvent
```

Describe the core invariants that must remain inside this module.

## Features

```txt
application/features/{feature-name}
```

## Required Capabilities

- Capability 1 from another module or kernel contract.

## Events Published

```txt
module.resource.action_happened.v1
```

## Events Subscribed

```txt
other_module.resource.action_happened.v1
```

## Permissions

```txt
module.resource.action
```

## Persistence Ownership

```txt
schema.table
```

## API Interfaces

```txt
REST:
GraphQL:
gRPC:
Webhooks:
CLI:
```

## Security Notes

- Authentication requirements.
- Authorization policies.
- Audit requirements.
- Sensitive data classification.

## Observability

- Logs.
- Metrics.
- Traces.
- Audit events.
- Correlation context.

## Common Mistakes

- Mistake 1.
- Mistake 2.
- Private dependency mistake.
- Contract versioning mistake.

## Verification Checklist

- [ ] Manifest is complete.
- [ ] Public contracts are documented.
- [ ] Private internals are not imported externally.
- [ ] Events are versioned.
- [ ] Permissions are policy-based.
- [ ] Persistence ownership is explicit.
- [ ] Security and audit requirements are documented.
- [ ] Observability context is defined.
