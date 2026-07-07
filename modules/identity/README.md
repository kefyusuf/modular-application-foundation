# Module: Identity

## Purpose

The identity module owns authentication identity, credentials, sessions, tokens, and account lifecycle flows.

It exists separately from `access` because authentication proves who the actor is, while authorization decides what the actor can do.

## Responsibilities

- Register user.
- Authenticate user.
- Issue access token.
- Rotate refresh token.
- Revoke session.
- Request password reset.
- Reset password.
- Verify email.
- Expose identity reader capability.

## Non-Responsibilities

- Role and permission ownership belongs to `access`.
- Audit persistence belongs to `audit`.
- Email/SMS delivery belongs to `notification`.
- Business-specific profile data belongs to the owning domain module.

## Public Contracts

```txt
IdentityReader
Authenticator
TokenIssuer
SessionManager
```

## Required Capabilities

- `audit.log`
- `notification.send`
- `access.evaluate_policy`

## Events Published

```txt
identity.user.registered.v1
identity.user.login_succeeded.v1
identity.user.login_failed.v1
identity.user.password_reset_requested.v1
identity.session.revoked.v1
```

## Events Subscribed

None.

## Permissions

```txt
identity.user.read
identity.user.create
identity.user.update
identity.session.revoke
```

## Persistence Ownership

```txt
identity.users
identity.credentials
identity.sessions
identity.refresh_tokens
```

## Security Notes

- Passwords must be hashed using a modern password-hashing algorithm.
- Login failures must be rate-limited.
- Refresh tokens must be rotated.
- Token revocation must be supported.
- Sensitive events must be audit logged.
- Bearer tokens must not be passed in internal message bodies.

## Verification Checklist

- [ ] Login failures are audited.
- [ ] Tokens are short-lived where appropriate.
- [ ] Refresh token replay is detected.
- [ ] Password reset tokens expire.
- [ ] Access module handles roles/permissions.
- [ ] Public contracts are documented.
- [ ] Private internals are not imported externally.
