import {
  ORCHESTRATION_AGENTS,
  shouldRunPlannedAgent,
} from './execution-strategies.js';
import {
  shouldRequestContextExpansion,
  shouldRunArchitectureAnalysis,
} from './routing-policies.js';

export const WORKFLOW_NODES = Object.freeze({
  context: 'context_agent',
  ruleEngine: 'rule_engine_agent',
  review: 'review_agent',
  architecture: 'architecture_agent',
  riskIntelligence: 'risk_intelligence_agent',
  smartReview: 'smart_review_agent',
  riskSummary: 'risk_summary_agent',
});

export const routingEngine = {
  decide(state, { stage } = {}) {
    if (stage === 'afterDependency') {
      return decideAfterDependency(state);
    }

    if (stage === 'afterReview') {
      return decideAfterReview(state);
    }

    if (stage === 'afterArchitecture') {
      return {
        nextAgent: WORKFLOW_NODES.riskIntelligence,
        reason: 'architecture analysis completed',
      };
    }

    return {
      nextAgent: WORKFLOW_NODES.riskIntelligence,
      reason: 'fallback route',
    };
  },
};

function decideAfterDependency(state) {
  const nextAgents = [];

  if (
    state.options?.includeSemanticContext &&
    shouldRunPlannedAgent(state.executionPlan, ORCHESTRATION_AGENTS.context)
  ) {
    nextAgents.push(WORKFLOW_NODES.context);
  }

  if (
    state.options?.includeRuleValidation !== false &&
    shouldRunPlannedAgent(state.executionPlan, ORCHESTRATION_AGENTS.rule)
  ) {
    nextAgents.push(WORKFLOW_NODES.ruleEngine);
  }

  if (nextAgents.length === 0) {
    return {
      nextAgent: WORKFLOW_NODES.review,
      reason: 'context and rule branches are not required',
    };
  }

  return {
    nextAgents,
    reason:
      nextAgents.length > 1
        ? 'context and rule branches can run in parallel'
        : 'single adaptive branch selected',
  };
}

function decideAfterReview(state) {
  if (shouldRequestContextExpansion(state)) {
    return {
      nextAgent: WORKFLOW_NODES.context,
      reason: 'review confidence below threshold; expand context and retry',
    };
  }

  if (shouldRunArchitectureAnalysis(state)) {
    return {
      nextAgent: WORKFLOW_NODES.architecture,
      reason: 'risk profile requires architecture analysis',
    };
  }

  return {
    nextAgent: WORKFLOW_NODES.riskIntelligence,
    reason: 'review confidence and risk profile are sufficient for final intelligence',
  };
}
