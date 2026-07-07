# Module: Audit

## Purpose

The audit module owns append-only audit logs and security-relevant event records.

It exists separately from observability because audit logs are accountability records, not debug logs.

## Responsibilities

- Record admin actions.
- Record security events.
- Record authorization failures.
- Record sensitive data access.
- Provide audit query capabilities.

## Non-Responsibilities

- Debug/application logs belong to observability infrastructure.
- Event sourcing streams belong to owning domain modules.
- Business-specific reporting belongs to the owning domain module.

## Public Contracts

```txt
AuditLogger
AuditReader
```

## Required Capabilities

None.

## Events Published

```txt
audit.security_event.recorded.v1
```

## Events Subscribed

None.

## Permissions

```txt
audit.log.read
audit.log.export
```

## Persistence Ownership

```txt
audit.audit_logs
```

## Security Notes

- Audit logs must be append-only.
- Sensitive fields must be masked or classified.
- Audit reads must be permission protected.
- Audit export must be separately permissioned.

## Verification Checklist

- [ ] Audit logs are append-only.
- [ ] Sensitive fields are masked.
- [ ] Security actions are recorded.
- [ ] Audit reads are permission protected.
- [ ] Public contracts are documented.
- [ ] Private internals are not imported externally.
