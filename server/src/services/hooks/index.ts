// server/src/services/hooks/index.ts
import { logger } from '../../middleware/logger.js';
import type { HookEventName, HookHandler, HookPlugin, IHookManager, HookResponse } from './types.js';

export * from './types.js';

class HookManager implements IHookManager {
  private handlers = new Map<HookEventName, Set<HookHandler<any>>>();
  private plugins = new Set<string>();

  register<E extends HookEventName>(eventName: E, handler: HookHandler<E>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);
    logger.debug({ eventName }, `Hook handler registered`);
  }

  async dispatch<E extends HookEventName>(eventName: E, payload: any): Promise<HookResponse[]> {
    const eventHandlers = this.handlers.get(eventName);
    if (!eventHandlers || eventHandlers.size === 0) {
      return [];
    }

    const responses: HookResponse[] = [];
    logger.debug({ eventName, handlerCount: eventHandlers.size }, `Dispatching hook event`);

    for (const handler of Array.from(eventHandlers)) {
      try {
        const result = await handler(payload);
        if (result) {
          responses.push(result);
        }
      } catch (err) {
        logger.error({ err, eventName }, `Hook handler failed execution for event: ${eventName}`);
        // Default failure to continue rather than hard abort unless specified
        responses.push({ action: 'continue', reason: 'handler_error' });
      }
    }
    
    return responses;
  }

  use(plugin: HookPlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn({ plugin: plugin.name }, `Plugin already registered, skipping.`);
      return;
    }
    try {
      plugin.initialize(this);
      this.plugins.add(plugin.name);
      logger.info({ plugin: plugin.name, description: plugin.description }, `Successfully mounted Hook Plugin`);
    } catch (err) {
      logger.error({ err, plugin: plugin.name }, `Failed to initialize Plugin`);
    }
  }
}

export const hookManager = new HookManager();
