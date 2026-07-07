# Module: Settings

## Purpose

The settings module owns application, module, tenant, and feature configuration.

It exists separately from business modules because configuration reads and feature-flag evaluation should be stable shared capabilities.

## Responsibilities

- Read setting value.
- Update setting value.
- Evaluate feature flag.
- Scope settings by app, module, tenant, or environment.
- Publish setting change events.

## Non-Responsibilities

- Business rules controlled by settings belong to the owning domain module.
- Secret storage belongs to a secret manager capability.
- Audit log persistence belongs to `audit`.
- UI rendering of settings belongs to interface shells.

## Public Contracts

```txt
SettingsReader
FeatureFlagEvaluator
```

## Required Capabilities

- `audit.log`

## Events Published

```txt
settings.value.changed.v1
settings.feature_flag.changed.v1
```

## Events Subscribed

None.

## Permissions

```txt
settings.value.read
settings.value.update
settings.feature_flag.manage
```

## Persistence Ownership

```txt
settings.values
settings.feature_flags
```

## Security Notes

- Sensitive configuration values must not be stored as plain settings.
- Settings writes must be permission protected and audit logged.
- Feature flag changes must be observable and reversible.
- Reads must respect tenant or workspace scope.

## Verification Checklist

- [ ] Setting writes are audit logged.
- [ ] Feature flags are scoped correctly.
- [ ] Sensitive values are not stored in plain settings.
- [ ] Cache invalidates after changes.
- [ ] Public contracts are documented.
- [ ] Private internals are not imported externally.
