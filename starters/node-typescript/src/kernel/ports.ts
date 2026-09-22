export interface Actor {
  id: string;
  roles: string[];
}

export interface CommandHandler<C, R> {
  execute(command: C): Promise<R>;
}

export interface CommandBus {
  dispatch<C, R>(command: C): Promise<R>;
}

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}

export interface DomainEvent {
  type: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface Repository<TAggregate, TId> {
  get(id: TId): Promise<TAggregate>;
  save(aggregate: TAggregate, expectedVersion: number): Promise<void>;
}

export interface TransactionManager {
  withinTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface PolicyEvaluator {
  can(actor: Actor, action: string, resource?: object): Promise<boolean>;
}
