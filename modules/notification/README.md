# Module: Notification

## Purpose

The notification module owns notification orchestration across email, SMS, push, and webhooks.

It exists separately from domain modules because delivery channels and retries are infrastructure-facing concerns behind a stable capability.

## Responsibilities

- Send notification through configured channel.
- Track notification status.
- Apply templates.
- Retry failed delivery.
- Publish notification status events.

## Non-Responsibilities

- User identity belongs to `identity`.
- Business decisions about whether to notify belong to the owning domain module.
- Audit log persistence belongs to `audit`.
- Provider-specific SDK details belong to infrastructure adapters.

## Public Contracts

```txt
NotificationSender
NotificationStatusReader
```

## Required Capabilities

- `audit.log`

## Events Published

```txt
notification.message.sent.v1
notification.message.failed.v1
```

## Events Subscribed

```txt
identity.user.registered.v1
```

## Permissions

```txt
notification.message.read
notification.template.manage
```

## Persistence Ownership

```txt
notification.messages
notification.templates
```

## Security Notes

- Notification payloads may include PII and must be minimized.
- Delivery provider credentials must be handled as secrets.
- Template changes must be permission protected.
- Failed delivery retries must be bounded and observable.

## Verification Checklist

- [ ] Notification delivery goes through a public capability.
- [ ] Provider details stay behind adapters.
- [ ] Failed deliveries are observable.
- [ ] Templates are permission protected.
- [ ] Public contracts are documented.
- [ ] Private internals are not imported externally.
