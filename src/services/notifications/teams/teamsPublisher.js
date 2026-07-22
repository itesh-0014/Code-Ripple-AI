import { teamsClient } from './teamsClient.js';
import { formatTeamsNotification } from './teamsFormatter.js';

export class TeamsPublisher {
  constructor({ client = teamsClient } = {}) {
    this.client = client;
  }

  async publish({ webhookUrl, notification }) {
    const payload = formatTeamsNotification(notification);
    const result = await this.client.send(webhookUrl, payload);

    return {
      ...result,
      payload,
    };
  }
}

export const teamsPublisher = new TeamsPublisher();
