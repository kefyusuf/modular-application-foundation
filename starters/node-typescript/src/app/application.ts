import {
  createInMemoryCommandBus,
  createInMemoryEventBus,
  createImmediateTransactionManager,
} from '../kernel/container.js';
import { createSubscribingEventBus } from '../kernel/event-router.js';
import type { CommandHandler } from '../kernel/ports.js';
import { RegisterUserHandler } from '../modules/identity/application/features/register-user/handler.js';
import { RegisterUserCommand } from '../modules/identity/application/features/register-user/command.js';
import { LoginHandler } from '../modules/identity/application/features/login/handler.js';
import { LoginCommand } from '../modules/identity/application/features/login/command.js';
import { InMemoryUserRepository } from '../modules/identity/infrastructure/persistence/in-memory-user-repository.js';
import { InMemoryPolicyEvaluator } from '../modules/access/infrastructure/in-memory-policy-evaluator.js';
import { InMemoryAuditLogger } from '../modules/audit/infrastructure/in-memory-audit-logger.js';
import { createAuditSubscriber } from '../modules/audit/application/on-user-registered.js';
import { InMemoryNotificationSender } from '../modules/notification/infrastructure/in-memory-notification-sender.js';
import { createWelcomeEmailSubscriber } from '../modules/notification/application/on-user-registered.js';
import { InMemorySettingStore } from '../modules/settings/infrastructure/in-memory-setting-store.js';
import { Permissions } from '../modules/identity/public/permissions.js';
import { createHttpHandler } from './http.js';
import { ScryptPasswordHasher } from '../modules/identity/infrastructure/auth/scrypt-password-hasher.js';
import { JwtTokenService } from '../modules/identity/infrastructure/auth/jwt-token-service.js';
import { AuthenticateCommand } from '../modules/identity/application/features/authenticate/command.js';
import { AuthenticateHandler } from '../modules/identity/application/features/authenticate/handler.js';
import { CurrentUserCommand } from '../modules/identity/application/features/current-user/command.js';
import { CurrentUserHandler } from '../modules/identity/application/features/current-user/handler.js';
import type { SigningKeyRing } from '../modules/identity/public/auth-contracts.js';
import { InMemorySessionStore } from '../modules/identity/infrastructure/auth/in-memory-session-store.js';
import { RefreshSessionCommand } from '../modules/identity/application/features/refresh-session/command.js';
import { RefreshSessionHandler } from '../modules/identity/application/features/refresh-session/handler.js';
import { LogoutCommand } from '../modules/identity/application/features/logout/command.js';
import { LogoutHandler } from '../modules/identity/application/features/logout/handler.js';
import type { SqlDatabase } from '../kernel/sql.js';
import { PostgresUserRepository } from '../modules/identity/infrastructure/persistence/postgres-user-repository.js';
import { PostgresSessionStore } from '../modules/identity/infrastructure/auth/postgres-session-store.js';
import { PostgresOutboxEventBus, PostgresOutboxDispatcher } from '../modules/identity/infrastructure/persistence/postgres-outbox.js';

export async function createApplication(options: { tokenKeys?: SigningKeyRing; database?: SqlDatabase } = {}) {
  if (options.database && !options.tokenKeys) throw new Error('Persistent storage requires configured JWT keys');
  if (options.database) await options.database.query('SELECT id FROM identity.users LIMIT 0');
  const users = options.database ? new PostgresUserRepository(options.database) : new InMemoryUserRepository();
  const eventLog: string[] = [];
  const audit = new InMemoryAuditLogger();
  const notifications = new InMemoryNotificationSender();
  const settings = new InMemorySettingStore();
  await settings.set('security.max_login_attempts', 5);

  const delivery = createSubscribingEventBus(createInMemoryEventBus(eventLog), [
    createAuditSubscriber(audit),
    createWelcomeEmailSubscriber(notifications),
  ]);
  const eventBus = options.database ? new PostgresOutboxEventBus(options.database) : delivery;
  const outbox = options.database ? new PostgresOutboxDispatcher(options.database, delivery) : undefined;
  const transactionManager = options.database ?? createImmediateTransactionManager();
  const policyEvaluator = new InMemoryPolicyEvaluator([
    { role: 'admin', permissions: [Permissions.UserCreate, Permissions.UserRead, Permissions.Login] },
    { role: 'user', permissions: [Permissions.UserRead, Permissions.Login] },
    { role: 'anonymous', permissions: [Permissions.Login] },
  ]);

  const passwords = new ScryptPasswordHasher();
  const sessions = options.database ? new PostgresSessionStore(options.database) : new InMemorySessionStore();
  const tokens = new JwtTokenService(undefined, options.tokenKeys, sessions);
  const registerUserHandler = new RegisterUserHandler(users, eventBus, transactionManager, passwords);
  const loginHandler = new LoginHandler(users, eventBus, transactionManager, settings, passwords);
  const handlers = new Map<string, CommandHandler<unknown, unknown>>([
    [RegisterUserCommand.name, registerUserHandler as CommandHandler<unknown, unknown>],
    [LoginCommand.name, loginHandler as CommandHandler<unknown, unknown>],
    [AuthenticateCommand.name, new AuthenticateHandler(loginHandler, tokens) as CommandHandler<unknown, unknown>],
    [CurrentUserCommand.name, new CurrentUserHandler(users, tokens, policyEvaluator) as CommandHandler<unknown, unknown>],
    [RefreshSessionCommand.name, new RefreshSessionHandler(users, tokens, eventBus, transactionManager) as CommandHandler<unknown, unknown>],
    [LogoutCommand.name, new LogoutHandler(tokens, eventBus, transactionManager) as CommandHandler<unknown, unknown>],
  ]);
  const commandBus = createInMemoryCommandBus(handlers);

  const handler = createHttpHandler({ commandBus, policyEvaluator });
  return { handler, users, eventLog, audit, notifications, settings, outbox, close: async () => { await options.database?.close(); } };
}
