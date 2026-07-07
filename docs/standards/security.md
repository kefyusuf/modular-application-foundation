# Security Standard

## Purpose

Define security controls that every implementation must consider from the start.

## Baseline Rules

- Use OWASP ASVS as the application security verification baseline.
- Authenticate every protected interface and authorize every sensitive action.
- Enforce object-level authorization in application logic, not only at routes.
- Use policy-based authorization for permissions and scoped roles.
- Follow JWT BCP guidance: allowlist algorithms, validate issuer/audience/time claims, and keep tokens short-lived.
- Follow OAuth 2.0 Security Best Current Practice for OAuth/OIDC flows.
- Protect cookie-authenticated unsafe browser requests with CSRF controls.
- Rate-limit login, reset, token, and other abuse-prone endpoints.
- Keep secrets out of code, logs, test fixtures, and generated docs.
- Audit security-sensitive actions.

## Security Baseline

Core controls:

```txt
- authentication
- authorization
- RBAC
- ABAC-ready policy evaluation
- object-level authorization
- CSRF strategy
- CORS strategy
- JWT validation
- OAuth/OIDC safe flows
- password hashing
- MFA/passkey extension points
- rate limiting
- brute-force protection
- secure headers
- audit logging
- sensitive-data masking
- secret management
- dependency scanning
- architecture/security tests
```

## JWT Rules

JWT implementations must:

- allowlist accepted algorithms;
- reject `none`;
- validate issuer;
- validate audience;
- validate expiration;
- validate not-before where used;
- support key rotation;
- use `jti` or equivalent for replay-sensitive flows;
- keep access tokens short-lived;
- use refresh token rotation for long sessions.

## CSRF Strategy

CSRF depends on auth transport:

| Client | Auth | CSRF |
|---|---|---|
| mobile | bearer token | usually not required |
| SPA with Authorization header | bearer token | usually not required |
| server-rendered web | cookie session | required |
| SPA with cookie auth | cookie session | required |
| admin panel | cookie/BFF | required |

## Authorization Rule

Never use hardcoded role checks in business logic.

Incorrect:

```txt
if user.role == "admin"
```

Correct:

```txt
policy.can(actor, "order.refund.approve", resource, context)
```

## Permission Naming

```txt
{module}.{resource}.{action}
```

Examples:

```txt
identity.user.read
identity.user.create
access.role.assign
audit.log.read
admin.panel.access
```

## Audit Rule

Security-sensitive actions must be audit logged:

- login success/failure;
- password reset request;
- MFA change;
- role assignment;
- permission change;
- admin action;
- data export;
- access denied;
- token revocation.

## Common Mistakes

- Checking only `user.role == "admin"` instead of evaluating policies.
- Trusting JWT claims without issuer, audience, expiration, and key validation.
- Using long-lived access tokens without refresh token rotation.
- Applying CSRF rules only to forms while cookie-authenticated APIs remain unsafe.
- Logging tokens, passwords, reset links, or secret values.
- Treating CORS as an authorization control.
- Forgetting rate limits on login, password reset, and token refresh endpoints.
- Auditing success paths but not failures or denied access.

## Verification Checklist

- [ ] Is object-level authorization performed?
- [ ] Are role checks policy-based?
- [ ] Are secrets excluded from logs?
- [ ] Are unsafe browser requests protected by CSRF controls?
- [ ] Are auth failures rate limited?
- [ ] Are sensitive actions audited?
