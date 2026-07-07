# Module: Access

## Purpose

The access module owns roles, permissions, scoped assignments, and policy evaluation.

It exists separately from `identity` because credentials and sessions are not the same responsibility as authorization decisions.

## Responsibilities

- Define permissions.
- Define roles.
- Assign roles to actors under scopes.
- Evaluate policies.
- Invalidate permission cache.
- Publish access-control events.

## Non-Responsibilities

- User credentials belong to `identity`.
- Audit log persistence belongs to `audit`.
- UI panels belong to interface shells.
- Business-specific policy data belongs to the owning domain module.

## Public Contracts

```txt
PolicyEvaluator
PermissionReader
RoleAssignmentManager
```

## Required Capabilities

- `audit.log`

## Events Published

```txt
access.role.assigned.v1
access.role.revoked.v1
access.permission.changed.v1
```

## Events Subscribed

```txt
identity.user.registered.v1
```

## Permissions

```txt
access.role.read
access.role.create
access.role.update
access.role.assign
access.permission.read
```

## Persistence Ownership

```txt
access.roles
access.permissions
access.role_assignments
```

## Security Notes

- Authorization must use policy evaluation, not hardcoded role strings.
- Scoped roles must include actor, resource, scope type, and scope ID.
- Permission cache must invalidate after role or permission changes.
- Role assignment changes must be audit logged.

## Verification Checklist

- [ ] Role checks are not hardcoded.
- [ ] Policy engine supports context.
- [ ] Scoped roles are supported.
- [ ] Permission cache invalidates after changes.
- [ ] Public contracts are documented.
- [ ] Private internals are not imported externally.
