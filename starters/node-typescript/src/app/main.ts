import { createServer } from 'node:http';
import {
  createInMemoryCommandBus,
  createInMemoryEventBus,
  createImmediateTransactionManager,
} from '../kernel/container.js';
import { createSubscribingEventBus } from '../kernel/event-router.js';
import type { CommandHandler } from '../kernel/ports.js';
import { RegisterUserHandler } from '../modules/identity/application/features/register-user/handler.js';
import { RegisterUserCommand } from '../modules/identity/application/features/register-user/command.js';
import { InMemoryUserRepository } from '../modules/identity/infrastructure/persistence/in-memory-user-repository.js';
import { InMemoryPolicyEvaluator } from '../modules/access/infrastructure/in-memory-policy-evaluator.js';
import { InMemoryAuditLogger } from '../modules/audit/infrastructure/in-memory-audit-logger.js';
import { createAuditSubscriber } from '../modules/audit/application/on-user-registered.js';
import { InMemoryNotificationSender } from '../modules/notification/infrastructure/in-memory-notification-sender.js';
import { createWelcomeEmailSubscriber } from '../modules/notification/application/on-user-registered.js';
import { Permissions } from '../modules/identity/public/permissions.js';
import { createHttpHandler } from './http.js';

const users = new InMemoryUserRepository();
const eventLog: string[] = [];
const audit = new InMemoryAuditLogger();
const notifications = new InMemoryNotificationSender();
const eventBus = createSubscribingEventBus(createInMemoryEventBus(eventLog), [
  createAuditSubscriber(audit),
  createWelcomeEmailSubscriber(notifications),
]);
const transactionManager = createImmediateTransactionManager();
const policyEvaluator = new InMemoryPolicyEvaluator([
  { role: 'admin', permissions: [Permissions.UserCreate, Permissions.UserRead] },
  { role: 'user', permissions: [Permissions.UserRead] },
]);

const registerUserHandler = new RegisterUserHandler(users, eventBus, transactionManager);
const handlers = new Map<string, CommandHandler<unknown, unknown>>([
  [RegisterUserCommand.name, registerUserHandler as CommandHandler<unknown, unknown>],
]);
const commandBus = createInMemoryCommandBus(handlers);

const handler = createHttpHandler({ commandBus, policyEvaluator });
const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  void handler(req, res);
});

server.listen(port, () => {
  console.log(`modular-application-foundation skeleton listening on :${port}`);
});
