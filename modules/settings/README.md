# Module: Settings

## Purpose

The settings module owns application, module, tenant, and feature configuration.

## Responsibilities

- Store settings.
- Resolve settings by scope.
- Expose feature flags.
- Invalidate setting cache.

## Verification Checklist

- [ ] Settings are scope-aware.
- [ ] Sensitive settings are not exposed.
- [ ] Feature flags support rollout strategy.
- [ ] Cache invalidates after setting changes.
