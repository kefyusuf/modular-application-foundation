# Node.js / TypeScript Runnable Skeleton

A runnable educational example with five modules, user registration, login, and authenticated current-user lookup.

## What it demonstrates

- kernel ports (`CommandBus`, `EventBus`, `Repository`, `TransactionManager`, `PolicyEvaluator`);
- identity module layers: `public`, `domain`, `application`, and `infrastructure`, with HTTP interfaces under `src/app`;
- feature slice `register-user` with validator, policy, handler, and result DTO;
- **access** module: role → permission policy evaluator;
- **audit** and **notification** modules: event subscribers on `identity.user.registered.v1`;
- **settings** module: typed `SettingReader`/`SettingWriter` used by login lockout;
- **login** use case with success/failure events and max-attempt lockout;
- contract-shaped authentication with server-side password hashing and JWT verification behind identity ports;
- refresh token rotation, session revocation, and configurable JWT signing/verification keys;
- in-memory adapters (repository, event bus, transaction manager);
- optional PostgreSQL user/session adapters and a transactional outbox with leased delivery and retry;
- durable audit entries and notification intents with consumer deduplication across restarts;
- versioned module migration catalogs with immutable history and transactional upgrades;
- real HTTP integration tests and executable module/layer boundary checks;
- HTTP adapter using `node:http` (no web framework lock-in);
- RFC 9457-style problem details for errors;
- runtime validation with zod at the untrusted boundary.

## Run

```bash
cd starters/node-typescript
npm ci
npm test
npm run typecheck
npm run dev
```

Requires Node.js 20 or later. The server listens on port 3000 by default; set `PORT` to override it. Without `DATABASE_URL`, all state is in memory and is lost when the process restarts.

Then:

```bash
curl -s -X POST http://localhost:3000/api/v1/identity/users \
  -H 'content-type: application/json' \
  -H 'x-actor-id: demo' \
  -H 'x-actor-roles: admin' \
  -d '{"email":"user@example.com","password":"a-long-password"}'
```

Use role `user` to see 403 from the access policy evaluator.

The `x-actor-id` and `x-actor-roles` headers supply a demo actor directly. They are caller-controlled and do not authenticate the caller.

Login after register:

```bash
curl -s -X POST http://localhost:3000/api/v1/identity/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"a-long-password"}'
```

The response contains `data.access_token`, `data.refresh_token`, `data.token_type`, `data.expires_in`, and request metadata. Use the access token to read the current identity:

```bash
ACCESS_TOKEN='<data.access_token from the login response>'
curl -s http://localhost:3000/api/v1/identity/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Refresh an active session using the latest refresh token from the login or refresh response:

```bash
curl -s -X POST http://localhost:3000/api/v1/identity/auth/refresh \
  -H 'content-type: application/json' \
  -d '{"refresh_token":"<latest data.refresh_token>"}'
```

Logout uses a valid access token and returns `204` without a body:

```bash
curl -i -X POST http://localhost:3000/api/v1/identity/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

For the original demo flow, register with `passwordHash` and log in at `/api/v1/identity/login` using the same `passwordHash`. That route keeps its flat result and demo token for compatibility. Standard password accounts cannot log in through the legacy route, and legacy demo tokens cannot authorize `/identity/me`. The standard login does not authenticate legacy illustrative credentials; register a new password account when migrating the example.

## Layout

```txt
src/
  kernel/ports.ts
  kernel/container.ts
  kernel/event-router.ts
  kernel/sql.ts
  infrastructure/postgres.ts
  modules/identity/
    public/
    domain/
    application/features/register-user/
    application/features/login/
    application/features/authenticate/
    application/features/current-user/
    application/features/refresh-session/
    application/features/logout/
    application/ports.ts
    infrastructure/persistence/
    infrastructure/auth/
  modules/access/
  modules/audit/
  modules/notification/
  modules/settings/
  app/
    main.ts
    migrate.ts
    application.ts
    http.ts
    actor.ts
    problem.ts
    request-context.ts
    token-config.ts
```

`app/application.ts` is the composition root: `createApplication()` creates fresh adapters, registers command handlers, and attaches event subscribers. `app/main.ts` starts the HTTP server with that application. Identity reads settings through the settings module's public contract. Audit and notification receive kernel event envelopes without importing identity internals.

## Verification

`npm test` runs unit tests, HTTP integration tests, and architecture checks. `npm run typecheck` checks both production and test sources; `npm run build` emits only production sources.

The HTTP suite starts the real application on an ephemeral loopback port for each test and closes the server afterwards. It covers registration and subscribers, policy denial without side effects, malformed input, legacy and standard login, account-specific lockout, successful-login counter reset, bearer identity lookup, health, and unknown routes. Standard login/current-user responses and authentication errors are validated against schemas read directly from the foundation OpenAPI file using YAML and Ajv. This validates the exercised response shapes, not the entire OpenAPI document.

Authentication adapter tests cover salted password hashes, invalid passwords, unsigned/altered/foreign/expired tokens, algorithm allowlisting, issuer/audience/type validation, required claims, and not-before checks. Session tests cover rotation, replay, competing refreshes, logout, absolute expiry, key rotation, and loss of session state. HTTP refresh/logout responses are checked against the OpenAPI contract. Application tests cover denied current-user access and revocation when an identity is missing.

Persistence tests run PostgreSQL SQL against a temporary, filesystem-backed [PGlite database](https://pglite.dev/docs/). They cover transaction rollback, normalized-email uniqueness, optimistic versions, reopening persistent users/sessions/replay history, outbox retry and lease recovery, stable delivery IDs, and the HTTP flow with SQL adapters. Consumer tests reopen the database after partial delivery and after effects complete before acknowledgement, verify deduplication survives restart, and verify failed effects leave no delivery receipt. Migration tests cover one-time upgrades, persistent history, changed/removed/reordered applied migrations, invalid catalogs, failed statements/history writes, whole-batch rollback, and adoption of the earlier unversioned schemas. PGlite uses one connection; these tests do not verify the `pg` network transport or competing workers on an external PostgreSQL server.

The architecture suite uses the TypeScript parser and module resolver to inspect production source dependencies. It rejects private cross-module access, application-to-infrastructure shortcuts, domain dependencies outside its own domain and kernel ports, private dependencies in public contracts, kernel dependencies on application/modules, and HTTP/interface access to domain, infrastructure, or repository ports. The composition root may wire concrete adapters. Test files are excluded from the production graph because integration tests intentionally assemble modules and inspect adapters.

Static imports, type imports, re-exports, literal dynamic imports, and literal `require` calls are checked. Computed dynamic imports are rejected because their targets cannot be resolved statically. Rule fixtures verify both allowed and forbidden edges. Manifest consistency, event schema/version checks, and semantic DTO leak analysis are not covered by this suite.

## HTTP behavior

| Method and path | Input | Success | Failure statuses |
|---|---|---|---|
| `GET /health` | None | `200` with `{ "status": "ok" }` | — |
| `POST /api/v1/identity/users` | `email` and `password`, or legacy `passwordHash`; actor headers with role `admin` | `201` with `{ "userId": "…", "email": "…" }` | `400` for invalid input or other caught errors; `403` for denied permission; `409` for duplicate email or version conflict |
| `POST /api/v1/identity/auth/login` | `email`, `password` | `200` with OpenAPI `data`/`meta` token response | `400` for invalid input; `401` for invalid credentials; `429` when locked out; `500` for unexpected failures |
| `POST /api/v1/identity/auth/refresh` | Latest `refresh_token`; no access token required | `200` with replacement tokens in a `data`/`meta` envelope | `400` for invalid input; `401` for unknown, expired, revoked, or reused refresh token; `500` for unexpected failures |
| `POST /api/v1/identity/auth/logout` | Verified bearer access token | `204` without a body | `401` for missing, expired, or revoked authentication; `500` for unexpected failures |
| `GET /api/v1/identity/me` | Verified bearer access token | `200` with `data` containing `id`, `email`, `permissions`, and a `meta` envelope | `401` for missing/invalid authentication; `403` for denied read permission; `500` for unexpected failures |
| `POST /api/v1/identity/login` (legacy) | `email`, `passwordHash` | `200` with `{ "userId": "…", "email": "…", "token": "token.…" }` | `400` for invalid input or other caught errors; `401` for invalid credentials; `429` when locked out |

Unknown routes return `404`. Errors use `application/problem+json` with `type`, `title`, `status`, request/correlation IDs, `instance`, and an optional `detail`. All credential inputs require a valid email. Standard registration requires a password of 8–1024 characters; standard login accepts a password string of up to 1024 characters. Legacy registration/login requires `passwordHash` of at least eight characters. Standard inputs reject unknown fields and ambiguous registration with both credential fields.

HTTP responses carry `X-Request-Id` and `X-Correlation-Id`. Caller IDs containing 1–128 ASCII letters, digits, dots, underscores, colons, or hyphens are accepted; otherwise a UUID is generated. A missing correlation ID defaults to the request ID. Standard success responses include these IDs in `meta`; errors include them at the top level. Token and current-user responses use `Cache-Control: no-store`.

Both login routes share `security.max_login_attempts`, initialized to 5 in the composition root, and the same counter. The first five failed attempts return `401`; subsequent validly shaped attempts return `429`, including attempts with the correct credential. Attempts are counted per normalized email in the handler's memory. A successful login before lockout clears the counter. There is no expiry or unlock endpoint; restarting the process clears the counters. Registered users survive restarts only in PostgreSQL mode.

## Relationship to foundation contracts

The foundation [OpenAPI example](../../contracts/openapi/public-api.v1.yml) describes standard login, refresh, logout, and current-user lookup. Those operations have matching routes and response shapes in the skeleton. Registration and the legacy demo login are additional skeleton operations outside that example.

| Area | Foundation contract or standard | Current skeleton |
|---|---|---|
| Login route | `/api/v1/identity/auth/login` | Implemented; original `/identity/login` remains a separate legacy demo |
| Login credential | `password` | Server-side scrypt hashing and verification behind `PasswordHasher` |
| Login response | `data`/`meta` envelope with access and refresh tokens | Implemented; access token is a signed, short-lived JWT |
| Current identity | `GET /api/v1/identity/me` with bearer authentication | Verified token, identity lookup, read policy, and contract-shaped DTO |
| Session lifecycle | Refresh rotation and bearer logout | Atomic rotation in both storage modes, replay revocation, and immediate access-token revocation |
| Registration | Not included in the foundation OpenAPI example | `POST /api/v1/identity/users` with a demo actor policy check |
| Request metadata | Request/correlation IDs in the contract and [API standard](../../docs/standards/api.md) | Returned in HTTP headers and standard response/error bodies; propagation into events/jobs remains future work |

The JWT adapter uses [jose](https://github.com/panva/jose), permits HS256, checks issuer/audience/type and required time claims, and issues access tokens with unique IDs and a session ID. Access tokens expire after at most 15 minutes, capped by the session's remaining lifetime. Authenticated users receive the demo `user` role; caller-provided actor headers do not change the bearer identity or its permissions.

## Session lifecycle

Each standard login creates an independent session with an absolute seven-day expiry. Refresh can renew an expired access token while that session remains active; it does not extend the session expiry. Refresh tokens contain 32 random bytes, encoded as base64url. Only their SHA-256 digests are retained in the session store, including consumed digests for replay detection.

`SessionStore.rotate` must compare and replace the current digest atomically. The in-memory implementation has no asynchronous suspension inside that operation; the PostgreSQL adapter locks the session row inside a transaction. Reusing any consumed token revokes its entire family, including access tokens issued before and after the refresh. Independent sessions remain usable. This follows the refresh rotation/replay principle in [RFC 9700 section 4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2); this password-based educational API is not an OAuth authorization server.

Clients must serialize refresh requests and replace the previous refresh token with the latest response. Competing requests with the same token trigger replay revocation; even a successful response from that race is unusable once revocation occurs. Ordinary rotation leaves older, unexpired access tokens usable until logout, replay detection, or session expiry.

Logout revokes the caller's current session, not every session for that user. All bearer authentication checks the session store, so revocation takes effect immediately. A second logout with the revoked token returns `401`. Logout requires an unexpired access token; refresh first if the access token has expired. Logout and refresh replay publish `identity.session.revoked.v1`, which the audit subscriber records without credentials or token values.

The default adapter retains session records and replay history in memory. Restarting it invalidates every session, even when signing keys are retained. PostgreSQL mode retains these records across restarts; neither adapter currently prunes expired sessions or replay history.

## JWT key configuration

The CLI reads `JWT_ACTIVE_KEY_ID` and `JWT_SIGNING_KEYS` from its environment. The latter is a JSON object mapping key IDs to canonical, unpadded base64url keys of at least 32 bytes. Token headers contain `kid`; verification accepts only configured keys. The active ID selects the signing key. In development, omitting both variables generates an ephemeral key. With `NODE_ENV=production`, both variables are required; malformed or incomplete configuration stops startup without printing key values.

For a development session in PowerShell:

```powershell
$jwtKey = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
$env:JWT_ACTIVE_KEY_ID = 'local-1'
$env:JWT_SIGNING_KEYS = @{ 'local-1' = $jwtKey } | ConvertTo-Json -Compress
npm run dev
```

This example generates a new key each time. To retain keys across starts, supply the same configuration through your environment or a secret-management adapter. The application does not save keys or automatically read a `.env` file. `createApplication({ tokenKeys })` also accepts a key ring directly for embedding/testing.

For rotation, configure both old and new keys and set the active ID to the new key. New tokens use that key; old tokens remain verifiable while the old key and their session records remain available. Remove the old key after its access tokens expire, or earlier to invalidate them immediately. Retaining keys alone does not preserve in-memory sessions. PostgreSQL mode requires configured keys and preserves sessions when both the database and required keys are retained.

The [AsyncAPI example](../../contracts/asyncapi/events.v1.yml) defines an integration envelope with CloudEvents-style metadata and `data.user_id`. The skeleton publishes internal domain events with `type`, `occurredAt`, and `data.userId`. The PostgreSQL outbox stores both the internal event and an integration envelope with snake-case data fields. Its correlation ID currently defaults to the event ID; HTTP context propagation and full AsyncAPI validation remain future work. Local subscribers receive the internal event plus a stable delivery ID.

## PostgreSQL mode

Configure the JWT keys described above, supply a PostgreSQL connection URL, and explicitly initialize the module schemas before starting:

```powershell
$env:DATABASE_URL = 'postgresql://app:replace-with-password@localhost:5432/foundation'
npm run migrate
npm run dev
```

`npm run migrate` applies the identity, audit, and notification migration catalogs in one transaction. The initial versions create identity-owned users, sessions, refresh-token history, and outbox tables, audit-owned entries, and notification-owned queued messages. Each module owns its tables and migration history. Startup checks all six required application tables are available; it does not run migrations automatically.

### Versioned migrations

Each module exports an ordered catalog from its infrastructure `schema.ts`. Entries contain a positive integer `version`, a nonempty `name`, and SQL `statements`. Add a new entry with a higher version to evolve the schema; retain every applied entry unchanged. Version gaps are allowed, but inserting an older version ahead of an already applied higher version is rejected.

The shared runner stores `version`, `name`, a SHA-256 checksum of the entry, and `applied_at` in each module's `schema_migrations` table. Re-running the command skips matching applied entries and runs only pending ones. Editing an applied name or statement (including whitespace), removing an applied entry, or using an incompatible older catalog stops the command before pending SQL executes. A statement or history-write failure rolls back the pending batch; the CLI's outer transaction also rolls back changes to preceding modules in that run.

Run the same command to adopt schemas created by the earlier unversioned initializer. Initial statements use `IF NOT EXISTS`, so records are retained while version 1 is recorded. This adoption assumes those schemas match the earlier initializer; checksums describe migration source, not the actual database structure. The runner does not detect manual schema drift or repair a dropped table from an already applied migration. Use a new migration or an explicit operational repair for that situation.

Run one migration process at a time. Concurrent migration coordination, down migrations, and nontransactional SQL operations such as `CREATE INDEX CONCURRENTLY` are not supported by this runner.

The SQL transaction manager keeps all queries in a transaction on the same connection. Registration saves the user and outbox event together; logout and replay revocation save the state change and event together. An outbox write failure rolls back those changes. Failed-login events commit even though the caller receives an authentication error.

The CLI polls the outbox every second and closes the server, pending poll, and database on shutdown. Embedded callers can use `createApplication({ tokenKeys, database })`, invoke `application.outbox.drain()`, and close the application when finished. Delivery claims have a 30-second lease; failures retry after an increasing delay capped at 60 seconds. Expired claims can be reclaimed. Delivery is at least once: a crash after subscriber effects and before acknowledgement can cause duplicates.

Audit and notification each persist a unique event ID with their effect in a single row, using PostgreSQL [ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html) to skip repeated delivery. This row acts as a durable consumer receipt: restarting between an effect and the outbox acknowledgement does not repeat the audit entry or queued notification. Consumers commit independently; retry resumes incomplete work if one succeeds and another fails. Calls without an idempotency key are independent operations and are not deduplicated.

`PostgresAuditLogger` stores audit entries; `PostgresNotificationQueue` stores notification intents with `pending` status. Queue acceptance completes local outbox delivery, but does not mean an email was sent. No external provider or notification delivery worker is implemented; that worker will need its own retry and provider idempotency strategy. Both adapters expose `list()` for local inspection; there is no inspection HTTP API. In-memory adapters expose the same helper. Settings and login counters remain in memory. There is no lease heartbeat, dead-letter handling, expiry cleanup, or strict delivery-order guarantee.

## Event flow

Registration publishes `identity.user.registered.v1`; the subscribers record an audit entry and collect a welcome email intent. The default mode stores these in memory; PostgreSQL mode persists them asynchronously during outbox delivery. No email is delivered externally. Login publishes `identity.user.login_succeeded.v1` or `identity.user.login_failed.v1`; those login events are not yet audited by the current subscribers. Session revocation publishes `identity.session.revoked.v1` with a logout/replay/missing-identity reason, which audit records. Notification handles only registration events.

## Intentional limits

- Default persistence is in memory. PostgreSQL mode retains users, sessions/replay history, outbox events, audit entries, and queued notification intents; settings and login counters remain in memory.
- Registration uses the access module's role-to-permission evaluator. The demo actor headers are not a production authentication mechanism.
- Standard credentials are hashed with scrypt and standard access tokens are signed/verified. The legacy route still uses illustrative strings and demo tokens.
- JWT keys support external configuration and rotation; a secret-manager adapter remains future work.
- The default `createImmediateTransactionManager` has no commit/rollback semantics. PostgreSQL mode provides rollback for producer changes, while subscriber effects remain outside that transaction.
- Outbox delivery uses in-process subscribers with durable local effect deduplication in PostgreSQL mode. No external broker or email delivery provider is implemented; external effects are not covered by this deduplication.
- PostgreSQL enforces normalized-email uniqueness and optimistic user versions. No settings HTTP API or timed login unlock is implemented.
- Tests cover registration, policy, subscribers, concurrency, login, settings, HTTP integration, authentication adapters, exercised OpenAPI responses, and module/layer imports. Full event contract conformance and manifest validation remain future work.

The architecture is the product here, not the demo features.
