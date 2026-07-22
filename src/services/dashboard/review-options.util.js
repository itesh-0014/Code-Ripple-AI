import { config } from '../../config/env.js';

export function buildReviewOptions(overrides = {}) {
  const fastMode = config.review.mode === 'fast';

  return {
    includeRuleValidation: true,
    includeAiReview: fastMode ? false : config.review.includeAiReview,
    includeSemanticContext: fastMode
      ? false
      : config.review.includeSemanticContext,
    ensureContextIndexed: !fastMode,
    failOnAiReviewError: false,
    publishGithubReview: true,
    publishNotifications: !fastMode,
    ...overrides,
  };
}
