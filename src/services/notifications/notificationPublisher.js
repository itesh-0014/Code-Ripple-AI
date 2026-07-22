import { config } from '../../config/env.js';
import { slackPublisher } from './slack/slackPublisher.js';
import { teamsPublisher } from './teams/teamsPublisher.js';

export class NotificationPublisher {
  constructor({
    publishers = {
      slack: slackPublisher,
      teams: teamsPublisher,
    },
    deduplicationTtlMs = config.notifications.deduplicationTtlMs,
    now = () => Date.now(),
  } = {}) {
    this.publishers = publishers;
    this.deduplicationTtlMs = deduplicationTtlMs;
    this.now = now;
    this.publishedKeys = new Map();
  }

  async publish({ notification, routes, deduplicationKey }) {
    this.removeExpiredKeys();
    const results = await Promise.all(
      routes.map(route =>
        this.publishRoute({
          notification,
          route,
          deduplicationKey,
        })
      )
    );

    const published = results.filter(result => result.status === 'published');
    const failed = results.filter(result => result.status === 'failed');
    const skipped = results.filter(result => result.status === 'duplicate');

    return {
      status:
        failed.length && !published.length
          ? 'failed'
          : failed.length
            ? 'partially-published'
            : published.length
              ? 'published'
              : skipped.length
                ? 'duplicate'
                : 'skipped',
      results,
      published,
      failed,
      skipped,
    };
  }

  async publishRoute({ notification, route, deduplicationKey }) {
    const destination = route.webhookUrl || route.channel;
    const routeKey = `${deduplicationKey}:${route.provider}:${destination}`;

    if (this.publishedKeys.has(routeKey)) {
      return {
        status: 'duplicate',
        provider: route.provider,
        channel: route.channel,
        routeKey: route.routeKey,
      };
    }

    if (!route.webhookUrl) {
      return {
        status: 'failed',
        provider: route.provider,
        channel: route.channel,
        routeKey: route.routeKey,
        error: {
          code: 'NOTIFICATION_WEBHOOK_NOT_CONFIGURED',
          message: `No webhook URL configured for ${route.provider}:${route.channel}.`,
          retryable: false,
        },
      };
    }

    const publisher = this.publishers[route.provider];

    if (!publisher) {
      return {
        status: 'failed',
        provider: route.provider,
        channel: route.channel,
        routeKey: route.routeKey,
        error: {
          code: 'NOTIFICATION_PROVIDER_UNSUPPORTED',
          message: `Unsupported notification provider: ${route.provider}.`,
          retryable: false,
        },
      };
    }

    try {
      const result = await publisher.publish({
        webhookUrl: route.webhookUrl,
        notification,
      });
      this.publishedKeys.set(routeKey, this.now());

      return {
        ...result,
        channel: route.channel,
        routeKey: route.routeKey,
      };
    } catch (error) {
      return {
        status: 'failed',
        provider: route.provider,
        channel: route.channel,
        routeKey: route.routeKey,
        error: {
          name: error.name || 'Error',
          code: error.code || 'NOTIFICATION_PUBLISH_FAILED',
          message: error.message,
          retryable: Boolean(error.retryable),
        },
      };
    }
  }

  removeExpiredKeys() {
    const cutoff = this.now() - this.deduplicationTtlMs;

    for (const [key, publishedAt] of this.publishedKeys.entries()) {
      if (publishedAt <= cutoff) {
        this.publishedKeys.delete(key);
      }
    }
  }
}

export const notificationPublisher = new NotificationPublisher();
