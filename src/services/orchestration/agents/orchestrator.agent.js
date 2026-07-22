import { aiReviewEngineService } from '../../ai-review/ai-review-engine.service.js';
import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';

export async function orchestratorAgent(state) {
  const startedAt = new Date();
  const warnings = [];

  validateGraphInput(state);

  if (state.options.includeAiReview && state.options.failOnAiReviewError) {
    aiReviewEngineService.validateConfiguration();
  }

  if (state.changedFiles.length === 0) {
    warnings.push('No changed files were provided to the orchestration graph.');
  }

  return {
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'orchestrator_agent',
      startedAt,
      details: {
        changedFileCount: state.changedFiles.length,
        orchestrationMode: 'adaptive-autonomous',
        includeSemanticContext: state.options.includeSemanticContext,
        includeRuleValidation: state.options.includeRuleValidation,
        includeAiReview: state.options.includeAiReview,
      },
      warnings,
    }),
  };
}

function validateGraphInput(state) {
  if (!state.repository?.source) {
    throw Object.assign(new Error('Phase 6 requires a repository source.'), {
      code: 'PHASE6_REPOSITORY_SOURCE_MISSING',
    });
  }

  if (state.repository.source === 'local' && !state.repository.path) {
    throw Object.assign(new Error('Local orchestration requires repository.path.'), {
      code: 'PHASE6_LOCAL_REPOSITORY_PATH_MISSING',
    });
  }

  if (state.repository.source === 'github') {
    const missingFields = ['installationId', 'owner', 'repo', 'ref'].filter(
      field => !state.repository[field]
    );

    if (missingFields.length > 0) {
      throw Object.assign(
        new Error(
          `GitHub orchestration is missing: ${missingFields.join(', ')}.`
        ),
        {
          code: 'PHASE6_GITHUB_REPOSITORY_INPUT_INCOMPLETE',
          missingFields,
        }
      );
    }
  }
}
