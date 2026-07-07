# Module: Notification

## Purpose

The notification module owns notification orchestration across channels such as email, SMS, push, and webhooks.

## Responsibilities

- Send notification through configured channel.
- Track notification status.
- Apply templates.
- Retry failed delivery.
- Publish notification status events.

## Non-Responsibilities

- User identity belongs to `identity`.
- Business decision to notify belongs to the producing module.

## Strategies

```txt
EmailNotificationStrategy
SmsNotificationStrategy
PushNotificationStrategy
WebhookNotificationStrategy
```

## Verification Checklist

- [ ] Sending is idempotent.
- [ ] Retry policy exists.
- [ ] Failed messages can go to dead letter.
- [ ] Templates do not leak secrets.
