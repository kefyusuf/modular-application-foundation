# Kernel Contract: Secret Manager

## Purpose

Retrieves and rotates runtime secrets used by infrastructure adapters and application bootstrap.

## Responsibility

The secret manager supplies credentials and keys to adapters at runtime. It keeps secrets out of source code, logs, domain models, and public contracts.

## Inputs

- Secret name or path.
- Environment or tenant scope.
- Version or stage, when supported.
- Access context from the calling adapter.

## Outputs

- Secret value or credential handle.
- Secret metadata: version, rotation time, expiry.
- Access denied or not found error.

## Pseudocode

```txt
interface SecretManager {
  getSecret(name, scope?): SecretValue
  getSecretMetadata(name, scope?): SecretMetadata
}
```

## Rules

- Domain and application code must not read secrets directly; only infrastructure adapters and bootstrap do.
- Secrets must never appear in logs, metrics, traces, events, or error messages.
- Prefer short-lived credentials and automatic rotation where the platform supports it.
- Least privilege: each adapter requests only the secrets it needs.
- Local development uses the same port with a local or environment adapter, not hardcoded values in domain tests.
- Secret values are write-only to logs and caches; never cache secrets in the general cache store.

## Common Adapters

- Cloud secret manager.
- Vault-style secret store.
- Environment or mounted-file adapter for local development.
- In-memory test double with fake values.

## Failure Modes

- Secret logged in an exception or structured log field.
- Hardcoded credential committed to the repository.
- Broad secret access granted to every module.
- Expired credential used because rotation is not wired.
- Secret leaked through event payloads or API errors.

## Verification Checklist

- [ ] Are secret reads limited to adapters and bootstrap?
- [ ] Are values excluded from logs and traces?
- [ ] Is rotation or expiry handled?
- [ ] Is access least-privilege per adapter?
- [ ] Do tests use a test double instead of real secret values?
