# Persistence Standard

## Purpose

Define the default data architecture and adapter strategy.

## Baseline Rules

- PostgreSQL is the initial source of truth.
- Each module owns its schema, migrations, aggregate persistence, and private tables.
- Cross-module reads must go through public contracts, projections, events, or capability ports.
- Repositories are for aggregate persistence, not every read query.
- Reporting and list screens should use query services, projections, or read models.
- NoSQL, cache, search, analytics, and queue stores are adapters, not the default system of record.
- Migrations must be backward-compatible where rolling deploys are expected.

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

## Common Mistakes

- Letting every module query every table because the database is shared.
- Creating cross-module foreign keys before ownership is clear.
- Using repositories for reporting queries and large list screens.
- Treating Redis, search, or analytics stores as the source of truth.
- Mixing migrations from multiple modules into one unowned folder.
- Making destructive schema changes without an expand/contract plan.
- Using database convenience as the integration boundary.

## Verification Checklist

- [ ] Does each table have a clear owner module?
- [ ] Are cross-module references explicit?
- [ ] Are critical writes transactional?
- [ ] Are read models separated from aggregate repositories?
- [ ] Are migrations safe for rolling deploys?
