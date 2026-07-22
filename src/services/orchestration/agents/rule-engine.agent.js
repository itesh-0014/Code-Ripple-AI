import { ruleEngineService } from '../../rule-engine/rule-engine.service.js';
import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';

export async function ruleEngineAgent(state) {
  const startedAt = new Date();
  const rulePolicy = state.rulePolicy || {};
  const validation = ruleEngineService.validatePullRequest({
    repository: state.repository,
    scanResult: state.scanResult,
    graph: state.graph,
    impact: state.impact,
    changedFiles: state.changedFiles,
    includedRuleCategories: rulePolicy.includedRuleCategories,
    excludedRuleCategories: rulePolicy.excludedRuleCategories,
    includedRuleIds: rulePolicy.includedRuleIds,
    excludedRuleIds: rulePolicy.excludedRuleIds,
  });

  return {
    validation,
    ruleFindings: validation.findings || [],
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'rule_engine_agent',
      startedAt,
      details: {
        rulesExecuted: validation.rules.total,
        validationTargets: validation.targets.total,
        totalFindings: validation.summary.totalFindings,
        highestSeverity: validation.summary.highestSeverity,
        rulePolicy,
      },
    }),
  };
}
