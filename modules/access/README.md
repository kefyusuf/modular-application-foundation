# Module: Access

## Purpose

The access module owns roles, permissions, scoped assignments, and policy evaluation.

## Responsibilities

- Define permissions.
- Define roles.
- Assign roles to actors under scopes.
- Evaluate policies.
- Invalidate permission cache.
- Publish access-control events.

## Non-Responsibilities

- User credentials belong to `identity`.
- UI panels belong to interface shells.
- Business-specific policy data belongs to the owning domain module.

## Events Published

```txt
access.role.assigned.v1
access.role.revoked.v1
access.permission.changed.v1
```

## Permissions

```txt
access.role.read
access.role.create
access.role.update
access.role.assign
access.permission.read
```

## Verification Checklist

- [ ] Role checks are not hardcoded.
- [ ] Policy engine supports context.
- [ ] Scoped roles are supported.
- [ ] Permission cache invalidates after changes.
