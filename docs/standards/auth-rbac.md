# Auth and RBAC Standard

## Purpose

Define the identity and access-control foundation required by most applications.

## Identity Responsibilities

The identity module owns:

- users;
- credentials;
- sessions;
- refresh tokens;
- password reset tokens;
- email verification;
- MFA/passkey extension points;
- login/logout/refresh flows.

## Access Responsibilities

The access module owns:

- roles;
- permissions;
- role assignments;
- scoped roles;
- policy evaluation;
- permission cache invalidation.

## Role Assignment Model

```txt
user_id
role_id
scope_type
scope_id
assigned_by
assigned_at
expires_at optional
```

## Scoped Authorization

Examples:

```txt
role: tenant_admin
scope: tenant:123

role: project_maintainer
scope: project:456
```

## Panel Access

Panel access is permission-based:

```txt
admin.panel.access
vendor.panel.access
customer.panel.access
tenant.panel.access
backoffice.panel.access
```

## Role-Specific Login/Register/Reset

The auth core should stay shared. Role-specific screens are UI shells over the same identity capabilities.

```txt
/admin/login     -> requires admin panel context
/vendor/login    -> requires vendor panel context
/customer/login  -> customer context
```

## Verification Checklist

- [ ] Are roles data-driven?
- [ ] Are permissions named consistently?
- [ ] Are panels protected by permissions, not role strings?
- [ ] Can MFA/passkey be added without rewriting auth?
- [ ] Can sessions be revoked?
