import type { DomainEvent, EventBus } from './ports.js';

export type EventHandler = (event: DomainEvent) => Promise<void>;

export function createSubscribingEventBus(base: EventBus, subscribers: EventHandler[]): EventBus {
  return {
    async publish(event: DomainEvent): Promise<void> {
      await base.publish(event);
      for (const subscriber of subscribers) {
        await subscriber(event);
      }
    },
  };
}
