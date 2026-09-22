import { createServer } from 'node:http';
import {
  createAllowAllPolicyEvaluator,
  createInMemoryCommandBus,
  createInMemoryEventBus,
  createImmediateTransactionManager,
} from '../kernel/container.js';
import type { CommandHandler } from '../kernel/ports.js';
import { RegisterUserHandler } from '../modules/identity/application/features/register-user/handler.js';
import { RegisterUserCommand } from '../modules/identity/application/features/register-user/command.js';
import { InMemoryUserRepository } from '../modules/identity/infrastructure/persistence/in-memory-user-repository.js';
import { createHttpHandler } from './http.js';

const users = new InMemoryUserRepository();
const eventLog: string[] = [];
const eventBus = createInMemoryEventBus(eventLog);
const transactionManager = createImmediateTransactionManager();
const policyEvaluator = createAllowAllPolicyEvaluator();

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
