import { config } from '../../../config/env.js';
import { WebhookClient } from '../shared/webhookClient.js';

export class SlackClient extends WebhookClient {
  constructor(options = {}) {
    super({
      provider: 'slack',
      maxRetries: config.notifications.maxRetries,
      timeoutMs: config.notifications.timeoutMs,
      ...options,
    });
  }
}

export const slackClient = new SlackClient();
