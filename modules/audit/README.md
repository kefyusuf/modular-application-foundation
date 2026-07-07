# Module: Audit

## Purpose

The audit module owns append-only audit logs and security-relevant event records.

## Responsibilities

- Record admin actions.
- Record security events.
- Record authorization failures.
- Record sensitive data access.
- Provide audit query capabilities.

## Non-Responsibilities

- Debug/application logs belong to observability infrastructure.
- Event sourcing streams belong to owning domain modules.

## Verification Checklist

- [ ] Audit logs are append-only.
- [ ] Sensitive fields are masked.
- [ ] Security actions are recorded.
- [ ] Audit reads are permission protected.
