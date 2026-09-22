import type {
  CommandBus,
  CommandHandler,
  EventBus,
  PolicyEvaluator,
  TransactionManager,
} from './ports.js';

export function createInMemoryCommandBus(
  handlers: Map<string, CommandHandler<unknown, unknown>>,
): CommandBus {
  return {
    async dispatch<C, R>(command: C): Promise<R> {
      const name = (command as { constructor: { name: string } }).constructor.name;
      const handler = handlers.get(name);
      if (!handler) {
        throw new Error(`No handler registered for command ${name}`);
      }
      return handler.execute(command) as Promise<R>;
    },
  };
}

export function createInMemoryEventBus(log: string[] = []): EventBus {
  return {
    async publish(event) {
      log.push(`${event.type} ${event.occurredAt}`);
    },
  };
}

export function createImmediateTransactionManager(): TransactionManager {
  return {
    async withinTransaction<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
}

export function createAllowAllPolicyEvaluator(): PolicyEvaluator {
  return {
    async can() {
      return true;
    },
  };
}
