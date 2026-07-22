import { formatSlackNotification } from './slackFormatter.js';
import { slackClient } from './slackClient.js';

export class SlackPublisher {
  constructor({ client = slackClient } = {}) {
    this.client = client;
  }

  async publish({ webhookUrl, notification }) {
    const payload = formatSlackNotification(notification);
    const result = await this.client.send(webhookUrl, payload);

    return {
      ...result,
      payload,
    };
  }
}

export const slackPublisher = new SlackPublisher();
