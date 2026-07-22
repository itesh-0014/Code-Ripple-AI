import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFinalRiskIntelligence } from '../src/services/risk-intelligence/risk-intelligence.engine.js';
import { calculateSeverity } from '../src/services/risk-intelligence/severity/severityEngine.js';

test('builds a traceable critical risk result for auth changes', () => {
  const result = buildFinalRiskIntelligence(buildAuthRiskState());

  assert.equal(result.riskScore, 9.2);
  assert.equal(result.riskLevel, 'CRITICAL');
  assert.equal(result.severity, 'CRITICAL');
  assert.equal(result.confidence, 99);
  assert.ok(result.contributingFactors.includes('Authentication layer modified'));
  assert.ok(result.contributingFactors.includes('Rule engine detected Hardcoded Secret'));
  assert.ok(result.contributingFactors.includes('Rule engine detected Missing Validation'));
  assert.equal(
    Math.round(
      result.riskFactors.reduce((total, factor) => total + factor.score, 0) * 10
    ) / 10,
    result.riskScore
  );
});

test('severity policy combines risk score and confidence', () => {
  assert.equal(calculateSeverity({ riskScore: 9, confidence: 92 }), 'CRITICAL');
  assert.equal(calculateSeverity({ riskScore: 6.2, confidence: 87 }), 'HIGH');
  assert.equal(calculateSeverity({ riskScore: 8.5, confidence: 45 }), 'MEDIUM');
});

test('risk explanation is deterministic for identical input', () => {
  const state = buildAuthRiskState();
  const first = buildFinalRiskIntelligence(state);
  const second = buildFinalRiskIntelligence(state);

  assert.equal(first.riskExplanation, second.riskExplanation);
  assert.deepEqual(first.riskFactors, second.riskFactors);
});

function buildAuthRiskState() {
  return {
    changedFiles: [{ filename: 'src/auth/jwt.middleware.js' }],
    affectedModules: Array.from({ length: 14 }, (_, index) => ({
      path: `src/modules/module-${index}.js`,
    })),
    impact: {
      changedFiles: [
        {
          filename: 'src/auth/jwt.middleware.js',
          layer: 'auth-security',
        },
      ],
      summary: {
        affectedModuleCount: 14,
        maxPropagationDepth: 3,
      },
      propagationChains: Array.from({ length: 14 }, () => ({})),
    },
    ruleFindings: [
      {
        ruleName: 'Hardcoded Secret',
        severity: 'CRITICAL',
      },
      {
        ruleName: 'Missing Validation',
        severity: 'HIGH',
      },
    ],
    validation: {
      summary: {
        highestSeverity: 'HIGH',
      },
    },
    aiReview: {
      riskLevel: 'HIGH',
      confidence: 91,
      summary: 'Authentication validation must be restored.',
      findings: [
        {
          title: 'Critical Security Risk',
          severity: 'CRITICAL',
          description: 'Protected routes can be reached without validation.',
        },
      ],
    },
    architectureAnalysis: {
      architecturalRisk: 'HIGH',
      criticalSystemsAffected: ['Authentication', 'Protected APIs'],
    },
    dependencyGraph: {
      nodes: [{ unresolvedImports: [] }],
      parseErrors: [],
    },
    retrievedContext: Array.from({ length: 40 }, (_, index) => ({
      path: `src/context/context-${index}.js`,
    })),
    context: {
      summary: {
        uniqueRetrievedFiles: 20,
        retrievedChunks: 40,
      },
    },
    retries: {
      contextExpansion: 0,
    },
  };
}
