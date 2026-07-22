import assert from 'node:assert/strict';
import test from 'node:test';

import { NotificationPublisher } from '../src/services/notifications/notificationPublisher.js';
import { evaluateNotificationPolicy } from '../src/services/notifications/policies/notificationPolicies.js';
import {
  determineNotificationRoutes,
  determineRouteKeys,
} from '../src/services/notifications/policies/routingPolicies.js';
import { SlackClient } from '../src/services/notifications/slack/slackClient.js';
import { formatSlackNotification } from '../src/services/notifications/slack/slackFormatter.js';
import { formatTeamsNotification } from '../src/services/notifications/teams/teamsFormatter.js';
import { buildNotificationMessage } from '../src/services/notifications/templates/notificationTemplates.js';

test('notifies critical reviews and prioritizes the critical template', () => {
  const decision = evaluateNotificationPolicy(buildNotificationState(), {
    enabled: true,
    minimumSeverity: 'HIGH',
    lowConfidenceThreshold: 60,
    notifyMediumRisk: false,
  });

  assert.equal(decision.shouldNotify, true);
  assert.equal(decision.template, 'criticalRisk');
  assert.match(decision.reason, /CRITICAL severity/);
});

test('notifies low-confidence reviews even below the severity threshold', () => {
  const decision = evaluateNotificationPolicy(
    {
      ...buildNotificationState(),
      severity: 'LOW',
      riskLevel: 'LOW',
      confidence: 58,
      reviewSummary: {
        ...buildNotificationState().reviewSummary,
        architectureImpact: 'LOW',
      },
    },
    {
      enabled: true,
      minimumSeverity: 'HIGH',
      lowConfidenceThreshold: 60,
      notifyMediumRisk: false,
    }
  );

  assert.equal(decision.shouldNotify, true);
  assert.equal(decision.template, 'lowConfidence');
});

test('routes authentication and architecture risks using configured destinations', () => {
  process.env.TEST_SLACK_SECURITY_WEBHOOK = 'https://hooks.slack.test/security';
  process.env.TEST_TEAMS_ENGINEERING_WEBHOOK = 'https://teams.test/engineering';

  const routeConfig = {
    routes: {
      security: [
        {
          provider: 'slack',
          webhookEnv: 'TEST_SLACK_SECURITY_WEBHOOK',
          channel: 'security-alerts',
        },
      ],
      engineering: [
        {
          provider: 'teams',
          webhookEnv: 'TEST_TEAMS_ENGINEERING_WEBHOOK',
          channel: 'engineering-alerts',
        },
      ],
    },
    defaultWebhooks: {},
  };
  const routeKeys = determineRouteKeys(buildNotificationState());
  const routes = determineNotificationRoutes(buildNotificationState(), routeConfig);

  assert.deepEqual(routeKeys, ['security', 'engineering']);
  assert.deepEqual(
    routes.map(route => [route.provider, route.channel, route.webhookUrl]),
    [
      ['slack', 'security-alerts', 'https://hooks.slack.test/security'],
      ['teams', 'engineering-alerts', 'https://teams.test/engineering'],
    ]
  );

  delete process.env.TEST_SLACK_SECURITY_WEBHOOK;
  delete process.env.TEST_TEAMS_ENGINEERING_WEBHOOK;
});

test('formats Slack Block Kit and Teams Adaptive Card messages', () => {
  const state = buildNotificationState();
  const decision = evaluateNotificationPolicy(state, {
    enabled: true,
    minimumSeverity: 'HIGH',
    lowConfidenceThreshold: 60,
    notifyMediumRisk: false,
  });
  const notification = buildNotificationMessage(state, decision);
  const slack = formatSlackNotification(notification);
  const teams = formatTeamsNotification(notification);

  assert.match(slack.text, /octo\/backend-api PR #142/);
  assert.equal(slack.blocks[0].type, 'header');
  assert.equal(teams.type, 'message');
  assert.equal(
    teams.attachments[0].content.type,
    'AdaptiveCard'
  );
  assert.equal(
    teams.attachments[0].content.actions[0].url,
    'https://github.com/octo/backend-api/pull/142'
  );
});

test('retries rate limits and eventually publishes', async () => {
  let attempts = 0;
  const client = new SlackClient({
    maxRetries: 2,
    timeoutMs: 100,
    sleep: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      return attempts === 1
        ? response({ ok: false, status: 429, body: 'rate limited' })
        : response({ ok: true, status: 200 });
    },
  });

  const result = await client.send('https://hooks.slack.test/demo', {
    text: 'test',
  });

  assert.equal(result.status, 'published');
  assert.equal(result.attempts, 2);
  assert.equal(attempts, 2);
});

test('rejects invalid webhook URLs without retrying', async () => {
  let attempts = 0;
  const client = new SlackClient({
    maxRetries: 2,
    sleep: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      return response({ ok: true, status: 200 });
    },
  });

  await assert.rejects(
    () => client.send('not-a-url', { text: 'test' }),
    error => error.code === 'INVALID_WEBHOOK_URL' && error.retryable === false
  );
  assert.equal(attempts, 0);
});

test('publishes independently and suppresses duplicate destination alerts', async () => {
  const calls = [];
  const publisher = new NotificationPublisher({
    deduplicationTtlMs: 1000,
    publishers: {
      slack: {
        async publish({ notification }) {
          calls.push(notification.templateName);
          return {
            status: 'published',
            provider: 'slack',
            payload: { text: 'sent' },
          };
        },
      },
      teams: {
        async publish() {
          const error = new Error('Teams unavailable');
          error.code = 'NOTIFICATION_PROVIDER_UNAVAILABLE';
          error.retryable = true;
          throw error;
        },
      },
    },
  });
  const notification = {
    templateName: 'CRITICAL_RISK',
  };
  const routes = [
    {
      provider: 'slack',
      channel: 'security',
      routeKey: 'security',
      webhookUrl: 'https://hooks.slack.test/security',
    },
    {
      provider: 'teams',
      channel: 'engineering',
      routeKey: 'engineering',
      webhookUrl: 'https://teams.test/engineering',
    },
  ];

  const first = await publisher.publish({
    notification,
    routes,
    deduplicationKey: 'octo:backend-api:142:sha:critical',
  });
  const second = await publisher.publish({
    notification,
    routes: [routes[0]],
    deduplicationKey: 'octo:backend-api:142:sha:critical',
  });

  assert.equal(first.status, 'partially-published');
  assert.equal(first.published.length, 1);
  assert.equal(first.failed.length, 1);
  assert.equal(second.status, 'duplicate');
  assert.equal(calls.length, 1);
});

function buildNotificationState() {
  return {
    repository: {
      source: 'github',
      owner: 'octo',
      repo: 'backend-api',
      pullNumber: 142,
      headSha: 'abc123',
    },
    changedFiles: [
      {
        filename: 'src/auth/jwt.middleware.js',
      },
    ],
    affectedModules: ['Protected APIs'],
    riskScore: 8.9,
    riskLevel: 'CRITICAL',
    severity: 'CRITICAL',
    confidence: 92,
    architectureAnalysis: {
      architecturalRisk: 'HIGH',
      criticalSystemsAffected: ['Authentication', 'Protected APIs'],
    },
    reviewSummary: {
      headline: 'Authentication and protected API behavior changed.',
      affectedSystems: ['Authentication', 'Protected APIs'],
      architectureImpact: 'HIGH',
    },
  };
}

function response({ ok, status, body = '' }) {
  return {
    ok,
    status,
    headers: {
      get() {
        return null;
      },
    },
    async text() {
      return body;
    },
  };
}
