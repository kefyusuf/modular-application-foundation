# Node.js / TypeScript Runnable Skeleton

One vertical slice that implements the Modular Application Foundation boundaries as a runnable app.

## What it demonstrates

- kernel ports (`CommandBus`, `EventBus`, `Repository`, `TransactionManager`, `PolicyEvaluator`);
- identity module layers: `public`, `domain`, `application`, `infrastructure`, `interfaces`;
- feature slice `register-user` with validator, policy, handler, and result DTO;
- **access** module: role → permission policy evaluator;
- **audit** and **notification** modules: event subscribers on `identity.user.registered.v1`;
- **settings** module: typed `SettingReader`/`SettingWriter` used by login lockout;
- **login** use case with success/failure events and max-attempt lockout;
- in-memory adapters (repository, event bus, transaction manager);
- HTTP adapter using `node:http` (no web framework lock-in);
- RFC 9457-style problem details for errors;
- runtime validation with zod at the untrusted boundary.

## Run

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Then:

```bash
curl -s -X POST http://localhost:3000/api/v1/identity/users \
  -H 'content-type: application/json' \
  -H 'x-actor-id: demo' \
  -H 'x-actor-roles: admin' \
  -d '{"email":"user@example.com","passwordHash":"password-hash"}'
```

Use role `user` to see 403 from the access policy evaluator.

Login after register:

```bash
curl -s -X POST http://localhost:3000/api/v1/identity/login \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","passwordHash":"password-hash"}'
```

## Layout

```txt
src/
  kernel/ports.ts
  kernel/container.ts
  kernel/event-router.ts
  modules/identity/
    public/
    domain/
    application/features/register-user/
    infrastructure/persistence/
  modules/access/
  modules/audit/
  modules/notification/
  modules/settings/
  app/
    main.ts
    http.ts
```

## Intentional limits

- in-memory persistence only (swap `InMemoryUserRepository` for Postgres later);
- allow-all policy evaluator (wire the access module later);
- one module and one use case;
- no outbox/queue yet (events are logged in-process).

The architecture is the product here, not the demo features.
