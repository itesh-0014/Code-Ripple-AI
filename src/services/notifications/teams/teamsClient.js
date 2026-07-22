import { config } from '../../../config/env.js';
import { WebhookClient } from '../shared/webhookClient.js';

export class TeamsClient extends WebhookClient {
  constructor(options = {}) {
    super({
      provider: 'teams',
      maxRetries: config.notifications.maxRetries,
      timeoutMs: config.notifications.timeoutMs,
      ...options,
    });
  }
}

export const teamsClient = new TeamsClient();
