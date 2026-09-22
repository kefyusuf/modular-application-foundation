# Kernel Contract: Cache Store

## Purpose

Stores short-lived derived or frequently read values to reduce latency and load.

## Responsibility

The cache store accelerates reads. It never becomes the system of truth. Correctness still depends on module-owned persistence and explicit invalidation.

## Inputs

- Cache key and optional namespace.
- Value to store.
- Time to live.
- Tags or invalidation group.

## Outputs

- Cached value or miss.
- Write acknowledgement.
- Delete or invalidation result.

## Pseudocode

```txt
interface CacheStore {
  get(key): CacheHit | CacheMiss
  set(key, value, ttl, tags?): void
  delete(key): void
  invalidateTags(tags): void
}
```

## Rules

- Cache is optional and must be safe to bypass or clear entirely.
- Never store secrets or long-lived authorization decisions as the only check.
- Keys must be scoped by module, tenant, and relevant version or locale.
- Invalidation must happen when source data changes, or the entry must be short-lived enough to tolerate staleness.
- Cache misses and failures must fall back to authoritative reads.
- Domain code depends on the cache port only where caching is intentional, not as a hidden repository.

## Common Adapters

- Redis cache.
- In-process memory cache.
- Distributed cache with tag invalidation.
- No-op cache adapter for tests.

## Failure Modes

- Serving stale data after a write because invalidation was skipped.
- Cache stampede on hot keys.
- Cross-tenant key collision.
- Treating cache as source of truth after a database outage.
- Sensitive data stored without expiry or protection.

## Verification Checklist

- [ ] Can the system run correctly with cache cleared?
- [ ] Are keys tenant- and module-scoped?
- [ ] Is invalidation defined for every write path?
- [ ] Are TTLs chosen for the real staleness budget?
- [ ] Are authorization and secrets excluded from long-lived cache entries?
