import { aiReviewConfig } from '../../config/ai-review.config.js';
import { contextBundleBuilderService } from './context-bundle-builder.service.js';
import { promptBuilderService } from './prompt-builder.service.js';
import {
  GeminiConfigurationError,
  geminiAIService,
} from './gemini-ai.service.js';
import { remediationSuggestionService } from './remediation-suggestion.service.js';
import { reviewReportGeneratorService } from './review-report-generator.service.js';
import { structuredReviewFormatterService } from './structured-review-formatter.service.js';

class AIReviewEngineService {
  validateConfiguration() {
    geminiAIService.validateConfiguration();
  }

  async generatePullRequestReview({
    repository,
    scanResult,
    graph,
    impact,
    changedFiles,
    context,
    validation,
    reviewDepth,
    plannerDecision,
    executionPlan,
    architectureAnalysis,
  }) {
    this.validateConfiguration();

    const contextBundle = contextBundleBuilderService.build({
      repository,
      scanResult,
      graph,
      impact,
      changedFiles,
      context,
      validation,
      reviewDepth,
      plannerDecision,
      executionPlan,
      architectureAnalysis,
    });
    const prompt = promptBuilderService.buildPrompt(contextBundle);
    const geminiResponse = await geminiAIService.generateStructuredReview(prompt);
    const structuredReview = structuredReviewFormatterService.format({
      rawReview: geminiResponse.json,
      contextBundle,
      modelMetadata: geminiResponse.metadata,
    });
    const remediationPlan = remediationSuggestionService.generate({
      contextBundle,
      structuredReview,
    });

    return reviewReportGeneratorService.generate({
      contextBundle,
      structuredReview,
      remediationPlan,
    });
  }

  buildFailureReport({ error, repository }) {
    const isMissingKey = error instanceof GeminiConfigurationError;

    return {
      phase: 'phase-5-ai-review',
      status: 'failed',
      generatedAt: new Date().toISOString(),
      repository,
      error: {
        name: error.name || 'Error',
        code: error.code || 'AI_REVIEW_ERROR',
        message: error.message || 'AI review failed.',
        status: error.status || null,
        retryable: Boolean(error.retryable),
        providerMessage: error.providerMessage || null,
      },
      safeStop: true,
      model: {
        provider: 'gemini',
        model: aiReviewConfig.gemini.model,
      },
      instructions: isMissingKey
        ? [
          'Add GEMINI_API_KEY=your_api_key to the project .env file.',
          'Restart the Node process and run the review again.',
        ]
        : [
          'Review the Gemini error above.',
          'Fix credentials, quota, model, or network issues, then return Phase 5.',
        ],
    };
  }
}

export const aiReviewEngineService = new AIReviewEngineService();
