import { notificationPublisher } from '../../notifications/notificationPublisher.js';
import { evaluateNotificationPolicy } from '../../notifications/policies/notificationPolicies.js';
import { determineNotificationRoutes } from '../../notifications/policies/routingPolicies.js';
import { buildNotificationMessage } from '../../notifications/templates/notificationTemplates.js';
import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';

export async function notificationAgent(state) {
  const startedAt = new Date();

  if (state.options?.publishNotifications === false) {
    return buildSkippedResponse({
      startedAt,
      reason: 'Notifications disabled by options.publishNotifications.',
    });
  }

  const decision = evaluateNotificationPolicy(state);

  if (!decision.shouldNotify) {
    return buildSkippedResponse({
      startedAt,
      reason: decision.reason,
      decision,
    });
  }

  const routes = determineNotificationRoutes(state);

  if (!routes.length) {
    return buildSkippedResponse({
      startedAt,
      reason: 'Notification policy matched, but no routes are configured.',
      decision,
    });
  }

  const notification = buildNotificationMessage(state, decision);
  const publication = await notificationPublisher.publish({
    notification,
    routes,
    deduplicationKey: buildDeduplicationKey(state, notification),
  });
  const notifiedChannels = publication.published.map(result => ({
    provider: result.provider,
    channel: result.channel,
    routeKey: result.routeKey,
  }));
  const errors = publication.failed.map(result => result.error);

  return {
    notificationStatus: publication.status,
    notifiedChannels,
    notificationPayloads: publication.results.map(result => ({
      provider: result.provider,
      channel: result.channel,
      routeKey: result.routeKey,
      status: result.status,
      payload: result.payload || null,
      error: result.error || null,
    })),
    notificationDecision: decision,
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'notification_agent',
      startedAt,
      status: publication.status === 'failed' ? 'failed' : 'completed',
      details: {
        notificationStatus: publication.status,
        template: notification.templateName,
        routesEvaluated: routes.length,
        channelsNotified: notifiedChannels.length,
      },
      warnings: publication.status === 'partially-published'
        ? ['Some notification routes failed.']
        : [],
      errors,
    }),
  };
}

function buildSkippedResponse({ startedAt, reason, decision = null }) {
  return {
    notificationStatus: 'skipped',
    notifiedChannels: [],
    notificationPayloads: [],
    notificationDecision: decision,
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'notification_agent',
      startedAt,
      status: 'skipped',
      details: {
        notificationStatus: 'skipped',
        reason,
      },
      warnings: [reason],
    }),
  };
}

function buildDeduplicationKey(state, notification) {
  const repository = state.repository || {};

  return [
    repository.owner || repository.path || 'local',
    repository.repo || 'repository',
    repository.pullNumber || 'no-pr',
    repository.headSha || repository.ref || 'no-ref',
    notification.templateName,
    notification.severity,
  ].join(':');
}
