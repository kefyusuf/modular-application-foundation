# Correct vs Wrong: Module Communication

## Wrong

```txt
order module imports identity.infrastructure.UserRepository
```

Why it is wrong:

- Order becomes coupled to identity internals.
- Identity cannot change persistence without breaking order.
- Extraction becomes harder.

## Correct: Public Contract

```txt
order module depends on IdentityReader public contract
```

## Correct: Integration Event

```txt
identity publishes identity.user.registered.v1
order updates its own user_summary projection if needed
```

## Correct: Policy Engine

```txt
order asks policy.can(actor, "order.order.cancel", order, context)
```

## Verification

- [ ] Is the accessed type under another module's `public/` folder?
- [ ] Is the dependency declared in `module.manifest.yml`?
- [ ] Is there a contract/event/projection instead of private import?
