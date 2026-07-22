import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExecutionPlan,
  ORCHESTRATION_AGENTS,
} from '../src/services/orchestration/routing/execution-strategies.js';

test('plans risk intelligence after architecture and before summary', () => {
  const plan = buildExecutionPlan({
    analysis: {
      frontendOnly: false,
      authTouched: true,
      dataTouched: false,
      backendTouched: true,
    },
    riskScore: 80,
    options: {
      includeSemanticContext: false,
      includeRuleValidation: true,
    },
  });

  assert.deepEqual(plan.requiredAgents, [
    ORCHESTRATION_AGENTS.dependency,
    ORCHESTRATION_AGENTS.rule,
    ORCHESTRATION_AGENTS.review,
    ORCHESTRATION_AGENTS.architecture,
    ORCHESTRATION_AGENTS.riskIntelligence,
    ORCHESTRATION_AGENTS.smartReview,
    ORCHESTRATION_AGENTS.summary,
  ]);
});
