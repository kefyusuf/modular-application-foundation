# Module: Identity

## Purpose

The identity module owns authentication identity, credentials, sessions, tokens, and account lifecycle flows.

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

## Public Contracts

```txt
IdentityReader
Authenticator
TokenIssuer
SessionManager
```

## Events Published

```txt
identity.user.registered.v1
identity.user.login_succeeded.v1
identity.user.login_failed.v1
identity.user.password_reset_requested.v1
identity.session.revoked.v1
```

## Required Capabilities

```txt
audit.log
notification.send
access.evaluate_policy
```

## Permissions

```txt
identity.user.read
identity.user.create
identity.user.update
identity.session.revoke
identity.credential.rotate
```

## Security Notes

- Passwords must be hashed using a modern password-hashing algorithm.
- Login failures must be rate-limited.
- Refresh tokens must be rotated.
- Token revocation must be supported.
- Sensitive events must be audit logged.

## Verification Checklist

- [ ] Login failures are audited.
- [ ] Tokens are short-lived where appropriate.
- [ ] Refresh token replay is detected.
- [ ] Password reset tokens expire.
- [ ] Access module handles roles/permissions.
