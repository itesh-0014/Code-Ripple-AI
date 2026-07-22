import { buildInitialPRReviewState } from './graph/pr-review.state.js';
import { buildPRReviewWorkflow } from './graph/pr-review.workflow.js';
import { buildPhase6Report } from './utils/report-builder.util.js';

class PRReviewOrchestratorService {
  constructor() {
    this.workflow = buildPRReviewWorkflow();
  }

  async reviewPullRequest({
    installationId,
    owner,
    repo,
    pullNumber,
    ref,
    changedFiles,
    includeSemanticContext,
    failOnContextError,
    includeRuleValidation,
    includeAiReview,
    failOnAiReviewError,
    ensureContextIndexed,
    publishGithubReview,
    publishNotifications,
    debug,
  }) {
    return this.invoke({
      repository: {
        source: 'github',
        installationId,
        owner,
        repo,
        pullNumber,
        ref,
        headSha: ref,
      },
      changedFiles,
      options: removeUndefinedValues({
        includeSemanticContext,
        failOnContextError,
        includeRuleValidation,
        includeAiReview,
        failOnAiReviewError,
        ensureContextIndexed,
        publishGithubReview,
        publishNotifications,
        debug,
      }),
    });
  }

  async reviewLocalRepository({
    repositoryPath,
    changedFiles,
    includeSemanticContext,
    failOnContextError,
    includeRuleValidation,
    includeAiReview,
    failOnAiReviewError,
    ensureContextIndexed,
    publishGithubReview,
    publishNotifications,
    debug,
  }) {
    return this.invoke({
      repository: {
        source: 'local',
        path: repositoryPath,
      },
      changedFiles,
      options: removeUndefinedValues({
        includeSemanticContext,
        failOnContextError,
        includeRuleValidation,
        includeAiReview,
        failOnAiReviewError,
        ensureContextIndexed,
        publishGithubReview,
        publishNotifications,
        debug,
      }),
    });
  }

  async invoke({ repository, changedFiles, options = {} }) {
    const initialState = buildInitialPRReviewState({
      repository,
      changedFiles,
      options,
    });
    const finalState = await this.workflow.invoke(initialState);

    return buildPhase6Report(finalState);
  }
}

function removeUndefinedValues(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

export const prReviewOrchestratorService = new PRReviewOrchestratorService();
