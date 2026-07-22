import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCheckRunPayload,
  buildConfidenceBadge,
  buildRiskBadge,
  formatReviewComment,
} from '../src/services/github/commentFormatter.js';
import { ReviewPublisher } from '../src/services/github/reviewPublisher.js';

test('formats a concise GitSense review comment with risk and confidence badges', () => {
  const body = formatReviewComment(buildReviewState());

  assert.match(body, /<!-- gitsense-ai-review -->/);
  assert.match(body, /# GitSense AI Review/);
  assert.match(body, /Risk Score: \*\*8\.9 \/ 10\*\*/);
  assert.match(body, /Risk: \*\*RED CRITICAL\*\*/);
  assert.match(body, /Confidence: \*\*92% \(High Confidence\)\*\*/);
  assert.match(body, /Authentication/);
  assert.match(body, /src\/auth\/jwt\.middleware\.js/);
});

test('maps risk levels to GitHub check run statuses', () => {
  const critical = buildCheckRunPayload(buildReviewState());
  const warning = buildCheckRunPayload({
    ...buildReviewState(),
    riskScore: 5.2,
    riskLevel: 'MEDIUM',
    severity: 'MEDIUM',
  });
  const passed = buildCheckRunPayload({
    ...buildReviewState(),
    riskScore: 1.5,
    riskLevel: 'LOW',
    severity: 'LOW',
  });

  assert.equal(critical.status, 'CRITICAL');
  assert.equal(critical.conclusion, 'failure');
  assert.equal(warning.status, 'WARNING');
  assert.equal(warning.conclusion, 'neutral');
  assert.equal(passed.status, 'PASSED');
  assert.equal(passed.conclusion, 'success');
});

test('builds stable risk and confidence badges', () => {
  assert.equal(buildRiskBadge(null, 8.8).label, 'RED CRITICAL');
  assert.equal(buildRiskBadge('HIGH', 0).label, 'ORANGE HIGH');
  assert.deepEqual(buildConfidenceBadge(54), {
    percent: 54,
    label: 'Low Confidence',
  });
});

test('publisher updates marker comments, creates check run, and records history', async () => {
  const calls = [];
  const client = {
    async createOrUpdateIssueComment(payload) {
      calls.push(['comment', payload.marker]);
      return {
        action: 'updated',
        id: calls.length,
        htmlUrl: `https://example.test/comment/${calls.length}`,
      };
    },
    async createCheckRun(payload) {
      calls.push(['check', payload.conclusion]);
      return {
        id: 99,
        htmlUrl: 'https://example.test/check/99',
        status: 'completed',
        conclusion: payload.conclusion,
      };
    },
  };
  const historyService = {
    async recordReviewHistory(document) {
      calls.push(['history', document.repository]);
      return {
        id: 'history-1',
        skipped: false,
      };
    },
  };
  const publisher = new ReviewPublisher({ client, historyService });

  const result = await publisher.publish(buildReviewState());

  assert.equal(result.status, 'published');
  assert.equal(result.checkRunStatus, 'CRITICAL');
  assert.equal(result.reviewHistoryId, 'history-1');
  assert.deepEqual(calls.map(call => call[0]), ['comment', 'comment', 'check', 'history']);
});

function buildReviewState() {
  return {
    repository: {
      source: 'github',
      installationId: 123,
      owner: 'octo',
      repo: 'demo',
      pullNumber: 7,
      headSha: 'abc123',
    },
    changedFiles: [
      {
        filename: 'src/auth/jwt.middleware.js',
      },
    ],
    riskScore: 8.9,
    riskLevel: 'CRITICAL',
    confidence: 92,
    severity: 'CRITICAL',
    affectedModules: ['Protected APIs'],
    reviewSummary: {
      headline: 'Authentication middleware and JWT verification changed.',
      affectedSystems: ['Authentication', 'Protected APIs', 'Session Validation'],
      architectureImpact: 'HIGH',
      suggestedChanges: ['Add validation', 'Test protected routes'],
      topFindings: [
        {
          severity: 'CRITICAL',
          title: 'JWT validation regression',
          description: 'Protected routes may bypass validation.',
          filePath: 'src/auth/jwt.middleware.js',
        },
      ],
      criticalFiles: [
        {
          file: 'src/auth/jwt.middleware.js',
        },
      ],
      suggestedNextSteps: ['Run authentication regression tests.'],
    },
  };
}
