# Module: {module-name}

## Purpose

Explain what this module owns.

## Ownership

```txt
Business owner:
Technical owner:
Module type:
Lifecycle status:
```

## Responsibilities

- Responsibility 1
- Responsibility 2
- Responsibility 3

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

## Domain Model

```txt
Aggregate
Entity
ValueObject
DomainEvent
```

## Features

```txt
application/features/{feature-name}
```

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

## Common Mistakes

- Mistake 1.
- Mistake 2.

## Verification Checklist

- [ ] Manifest is complete.
- [ ] Public contracts are documented.
- [ ] Private internals are not imported externally.
- [ ] Events are versioned.
- [ ] Permissions are policy-based.
