import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSmartReviewIntelligence } from '../src/services/smart-review/smartReviewEngine.js';

test('classifies a large PR and allocates risk-first review budget', () => {
  const result = buildSmartReviewIntelligence(buildLargePRState());

  assert.equal(result.prSize, 'LARGE');
  assert.equal(result.reviewMode, 'RISK-FIRST REVIEW');
  assert.equal(result.changedFileCount, 35);
  assert.equal(result.reviewBudget.counts.deep, 7);
  assert.equal(result.reviewBudget.counts.standard, 11);
  assert.equal(result.reviewBudget.counts.light, 17);
  assert.equal(result.prioritizedFiles[0].file, 'src/auth/jwt.middleware.js');
  assert.ok(result.criticalFiles.some(file => file.file === 'src/auth/jwt.middleware.js'));
  assert.ok(result.hotspots.some(hotspot => hotspot.file === 'src/auth/jwt.middleware.js'));
});

test('keeps prioritization deterministic and traceable', () => {
  const state = buildLargePRState();
  const first = buildSmartReviewIntelligence(state);
  const second = buildSmartReviewIntelligence(state);
  const authFile = first.prioritizedFiles.find(
    file => file.file === 'src/auth/jwt.middleware.js'
  );
  const navbarFile = first.prioritizedFiles.find(
    file => file.file === 'src/components/Navbar.jsx'
  );

  assert.deepEqual(
    first.prioritizedFiles.map(file => ({ file: file.file, score: file.score })),
    second.prioritizedFiles.map(file => ({ file: file.file, score: file.score }))
  );
  assert.equal(authFile.score, 90);
  assert.equal(authFile.criticality, 'CRITICAL');
  assert.equal(authFile.factors.repositoryLayer.category, 'authentication');
  assert.equal(authFile.factors.dependencyCount.directDependents, 6);
  assert.equal(authFile.factors.ruleFindings.count, 1);
  assert.equal(navbarFile.criticality, 'LOW');
});

test('uses full review for small PRs', () => {
  const result = buildSmartReviewIntelligence({
    ...buildLargePRState(),
    changedFiles: [
      { filename: 'src/components/Navbar.jsx' },
      { filename: 'src/services/user.service.js' },
    ],
  });

  assert.equal(result.prSize, 'SMALL');
  assert.equal(result.reviewMode, 'FULL REVIEW');
  assert.equal(result.reviewBudget.counts.deep, 2);
  assert.equal(result.reviewBudget.counts.standard, 0);
  assert.equal(result.reviewBudget.counts.light, 0);
});

function buildLargePRState() {
  const changedFiles = [
    { filename: 'src/auth/jwt.middleware.js' },
    { filename: 'src/database/user.model.js' },
    { filename: 'src/components/Navbar.jsx' },
    ...Array.from({ length: 32 }, (_, index) => ({
      filename: `src/features/feature-${index}.js`,
    })),
  ];

  return {
    changedFiles,
    dependencyGraph: {
      nodes: [
        {
          path: 'src/auth/jwt.middleware.js',
          layer: 'auth-security',
          dependencies: ['src/config/env.js', 'src/database/user.model.js'],
          dependents: Array.from({ length: 6 }, (_, index) => `src/routes/route-${index}.js`),
        },
        {
          path: 'src/database/user.model.js',
          layer: 'data',
          dependencies: [],
          dependents: ['src/services/user.service.js', 'src/auth/jwt.middleware.js'],
        },
        {
          path: 'src/components/Navbar.jsx',
          layer: 'frontend-ui',
          dependencies: [],
          dependents: [],
        },
      ],
    },
    impact: {
      changedFiles: [
        {
          filename: 'src/auth/jwt.middleware.js',
          layer: 'auth-security',
          directDependencies: ['src/config/env.js', 'src/database/user.model.js'],
          directDependents: Array.from({ length: 6 }, (_, index) => `src/routes/route-${index}.js`),
          affectedModules: Array.from({ length: 12 }, (_, index) => ({
            path: `src/routes/route-${index}.js`,
          })),
        },
        {
          filename: 'src/database/user.model.js',
          layer: 'data',
          directDependencies: [],
          directDependents: ['src/services/user.service.js', 'src/auth/jwt.middleware.js'],
          affectedModules: [{ path: 'src/services/user.service.js' }],
        },
        {
          filename: 'src/components/Navbar.jsx',
          layer: 'frontend-ui',
          directDependencies: [],
          directDependents: [],
          affectedModules: [],
        },
      ],
    },
    ruleFindings: [
      {
        filePath: 'src/auth/jwt.middleware.js',
        ruleName: 'Missing Token Validation',
        severity: 'CRITICAL',
      },
    ],
    aiReview: {
      findings: [],
    },
    architectureAnalysis: {
      architecturalRisk: 'HIGH',
      criticalSystemsAffected: ['Authentication', 'Protected APIs'],
      cascadingFailureRisks: [
        {
          changedFile: 'src/auth/jwt.middleware.js',
          severity: 'HIGH',
        },
      ],
    },
  };
}

