import assert from 'node:assert/strict';
import test from 'node:test';

import { signSession, verifySession } from '../src/services/auth/jwt.service.js';
import { DashboardService } from '../src/services/dashboard/dashboard.service.js';

test('builds dashboard analytics and repository summaries from review history', async () => {
  const service = buildDashboardService();
  const analytics = await service.getAnalytics();
  const repositories = await service.getRepositories();

  assert.equal(analytics.totals.reviews, 3);
  assert.equal(analytics.totals.repositories, 2);
  assert.equal(analytics.totals.criticalReviews, 1);
  assert.equal(analytics.totals.averageRisk, 6);
  assert.equal(repositories[0].name, 'acme/api');
  assert.equal(repositories[0].reviewCount, 2);
});

test('filters review history by search, severity, repository, and date', async () => {
  const service = buildDashboardService();
  const result = await service.listReviews({
    search: 'auth',
    severity: 'CRITICAL',
    repository: 'acme/api',
    from: '2026-05-01',
    to: '2026-06-30',
  });

  assert.equal(result.pagination.total, 1);
  assert.equal(result.items[0].prNumber, 42);
});

test('creates and verifies signed dashboard sessions', () => {
  const token = signSession(
    { sub: 'user-1', user: { id: 'user-1', login: 'octo' } },
    { secret: 'test-secret', ttlSeconds: 60 }
  );
  const payload = verifySession(token, { secret: 'test-secret' });

  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.user.login, 'octo');
  assert.throws(
    () => verifySession(token, { secret: 'wrong-secret' }),
    error => error.code === 'INVALID_SESSION'
  );
});

function buildDashboardService() {
  const reviews = [
    {
      _id: 'review-1',
      repository: 'acme/api',
      prNumber: 42,
      title: 'Harden authentication middleware',
      riskScore: 9,
      confidence: 92,
      severity: 'CRITICAL',
      affectedSystems: ['Authentication'],
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
    },
    {
      _id: 'review-2',
      repository: 'acme/api',
      prNumber: 41,
      title: 'Tune database query',
      riskScore: 6,
      confidence: 88,
      severity: 'HIGH',
      affectedSystems: ['Database'],
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
    },
    {
      _id: 'review-3',
      repository: 'acme/web',
      prNumber: 12,
      title: 'Update navigation',
      riskScore: 3,
      confidence: 95,
      severity: 'LOW',
      affectedSystems: ['Frontend'],
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
    },
  ];
  const historyService = {
    isConfigured() {
      return true;
    },
    async listReviews() {
      return reviews;
    },
  };

  return new DashboardService({ historyService, demoMode: false });
}
