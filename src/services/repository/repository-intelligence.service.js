import { dependencyGraphService } from './dependency-graph.service.js';
import { impactAnalysisService } from './impact-analysis.service.js';
import { localRepositoryScanner } from './local-repository-scanner.service.js';
import { ragConfig } from '../../config/rag.config.js';
import { isSourceFile } from '../../utils/repository-path.util.js';
import { contextRetrievalService } from '../rag/context-retrieval.service.js';
import { ruleEngineService } from '../rule-engine/rule-engine.service.js';
import { aiReviewEngineService } from '../ai-review/ai-review-engine.service.js';

class RepositoryIntelligenceService {
  async analyzePullRequest({
    installationId,
    owner,
    repo,
    ref,
    changedFiles,
    includeSemanticContext = ragConfig.enabled,
    failOnContextError = false,
    includeRuleValidation = false,
    includeAiReview = false,
    failOnAiReviewError = true,
  }) {
    if (includeAiReview && failOnAiReviewError) {
      aiReviewEngineService.validateConfiguration();
    }

    const { githubRepositoryScanner } = await import(
      './github-repository-scanner.service.js'
    );

    const scanResult = await githubRepositoryScanner.scan({
      installationId,
      owner,
      repo,
      ref,
      scanMode: includeSemanticContext ? 'semantic' : 'source',
    }); 

    return this.analyzeScannedFiles({
      repository: {
        source: 'github',
        owner,
        repo,
        ref,
      },
      scanResult,
      changedFiles,
      includeSemanticContext,
      failOnContextError,
      includeRuleValidation,
      includeAiReview,
      failOnAiReviewError,
    });
  }

  async analyzeLocalRepository({
    repositoryPath,
    changedFiles,
    includeSemanticContext = false,
    failOnContextError = false,
    includeRuleValidation = false,
    includeAiReview = false,
    failOnAiReviewError = true,
  }) {
    if (includeAiReview && failOnAiReviewError) {
      aiReviewEngineService.validateConfiguration();
    }

    const scanResult = await localRepositoryScanner.scan(repositoryPath, {
      scanMode: includeSemanticContext ? 'semantic' : 'source',
    });

    return this.analyzeScannedFiles({
      repository: {
        source: 'local',
        path: scanResult.rootPath,
      },
      scanResult,
      changedFiles,
      includeSemanticContext,
      failOnContextError,
      includeRuleValidation,
      includeAiReview,
      failOnAiReviewError,
    });
  }

  async analyzeScannedFiles({
    repository,
    scanResult,
    changedFiles,
    includeSemanticContext = false,
    failOnContextError = false,
    includeRuleValidation = false,
    includeAiReview = false,
    failOnAiReviewError = true,
  }) {
    const shouldRunRuleValidation = includeRuleValidation || includeAiReview;
    const sourceFiles = scanResult.files.filter(file => isSourceFile(file.path));
    const dependencyGraph = dependencyGraphService.buildGraph(sourceFiles);
    const impact = impactAnalysisService.analyze({
      graph: dependencyGraph,
      changedFiles,
    });

    const report = {
      phase: 'phase-2-repository-intelligence',
      repository,
      scan: scanResult.summary,
      graph: {
        summary: dependencyGraph.summary,
        edges: dependencyGraph.edges,
        externalDependencies: dependencyGraph.externalDependencies,
        parseErrors: dependencyGraph.parseErrors,
      },
      impact,
    };

    if (!includeSemanticContext && !shouldRunRuleValidation && !includeAiReview) {
      return report;
    }

    if (includeSemanticContext) {
      try {
        report.context = await contextRetrievalService.retrieveForPullRequest({
          repository,
          scanResult,
          graph: dependencyGraph,
          impact,
          changedFiles,
          ensureIndexed: true,
        });
      } catch (error) {
        if (failOnContextError) {
          throw error;
        }

        report.context = {
          phase: 'phase-3-context-retrieval',
          error: error.message,
        };
      }
    }

    if (shouldRunRuleValidation) {
      report.validation = ruleEngineService.validatePullRequest({
        repository,
        scanResult,
        graph: dependencyGraph,
        impact,
        changedFiles,
      });
    }

    if (includeAiReview) {
      try {
        report.aiReview = await aiReviewEngineService.generatePullRequestReview({
          repository,
          scanResult,
          graph: dependencyGraph,
          impact,
          changedFiles,
          context: report.context,
          validation: report.validation,
        });
      } catch (error) {
        if (failOnAiReviewError) {
          throw error;
        }

        report.aiReview = aiReviewEngineService.buildFailureReport({
          error,
          repository,
        });
      }
    }

    return report;
  }
}

export const repositoryIntelligenceService = new RepositoryIntelligenceService();
