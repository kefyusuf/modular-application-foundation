# Persistence Standard

## Purpose

Define the default data architecture and adapter strategy.

## Default Source of Truth

Use PostgreSQL as the initial source of truth.

Reasons:

- ACID transactions;
- relational constraints;
- JSONB where needed;
- indexing;
- views/materialized views;
- advisory locks;
- row-level security where suitable;
- event store compatibility;
- projection/read model support.

## Module-Owned Schema

Recommended:

```txt
identity.users
identity.credentials
access.roles
access.permissions
audit.audit_logs
notification.messages
```

## Cross-Module Data Rule

A module must not directly query another module's private tables.

Use:

- public query contract;
- read model projection;
- integration event;
- capability port;
- policy engine.

## Repository Rule

Repository is for aggregate persistence.

Reporting and list screens should use query services or projections.

## NoSQL Strategy

NoSQL systems are adapters, not default source of truth.

| Technology | Best Fit |
|---|---|
| MongoDB | document read models, flexible content, activity streams |
| Couchbase | high-performance document/cache hybrid scenarios |
| Redis | cache, lock, rate limit, session, streams |
| Elasticsearch/OpenSearch | search indexes |
| ClickHouse | analytics |

## Migration Rules

- Each module owns its migrations.
- Cross-module migrations are forbidden by default.
- Destructive changes require migration plan.
- Backward-compatible expand/contract migration is preferred.

## Verification Checklist

- [ ] Does each table have a clear owner module?
- [ ] Are cross-module references explicit?
- [ ] Are critical writes transactional?
- [ ] Are read models separated from aggregate repositories?
- [ ] Are migrations safe for rolling deploys?
