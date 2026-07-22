import { dependencyGraphService } from '../../repository/dependency-graph.service.js';
import { impactAnalysisService } from '../../repository/impact-analysis.service.js';
import { localRepositoryScanner } from '../../repository/local-repository-scanner.service.js';
import { isSourceFile } from '../../../utils/repository-path.util.js';
import {
  applyRoutingRiskSignals,
  buildRoutingProfile,
} from '../utils/routing-profile.util.js';
import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';
import {
  calculateAdaptiveRiskScore,
  riskLevelFromScore,
} from '../routing/routing-policies.js';
import { refineExecutionPlanAfterDependency } from '../routing/execution-strategies.js';

export async function dependencyAgent(state) {
  const startedAt = new Date();
  const scanMode = state.options.includeSemanticContext ? 'semantic' : 'source';
  const { repository, scanResult, reportRepository } = await scanRepository({
    repository: state.repository,
    scanMode,
  });
  const sourceFiles = scanResult.files.filter(file => isSourceFile(file.path));
  const graph = dependencyGraphService.buildGraph(sourceFiles);
  const rawImpact = impactAnalysisService.analyze({
    graph,
    changedFiles: state.changedFiles,
  });
  const routeProfile = buildRoutingProfile({
    impact: rawImpact,
    scanResult,
  });
  const impact = applyRoutingRiskSignals({
    impact: rawImpact,
    routeProfile,
  });
  const riskScore = calculateAdaptiveRiskScore({
    baseRiskScore: state.riskScore,
    impact,
    routeProfile,
  });
  const riskLevel = riskLevelFromScore(riskScore);
  const executionPlan = refineExecutionPlanAfterDependency({
    executionPlan: state.executionPlan,
    options: state.options,
    routeProfile,
    impact,
    riskScore,
    riskLevel,
  });

  return {
    repository: reportRepository || repository,
    scanResult,
    graph,
    impact,
    affectedModules: impact.affectedModules,
    dependencyGraph: serializeDependencyGraph(graph),
    routeProfile,
    rulePolicy: routeProfile.rulePolicy,
    riskScore,
    routingRiskScore: riskScore,
    reviewDepth: executionPlan.reviewDepth,
    executionPlan,
    executionMetadata: {
      ...buildAgentExecutionMetadata({
        agentName: 'dependency_agent',
        startedAt,
        details: {
          scanMode,
          sourceFiles: sourceFiles.length,
          affectedModuleCount: impact.affectedModules.length,
          reviewMode: routeProfile.reviewMode,
          riskLevel,
          riskScore,
        },
      }),
      routing: {
        dependency: {
          reviewMode: routeProfile.reviewMode,
          conditions: routeProfile.conditions,
          rulePolicy: routeProfile.rulePolicy,
          riskLevel,
          riskScore,
          requiredAgents: executionPlan.requiredAgents,
        },
      },
    },
  };
}

async function scanRepository({ repository, scanMode }) {
  if (repository.source === 'local') {
    const scanResult = await localRepositoryScanner.scan(repository.path, {
      scanMode,
    });

    return {
      repository,
      scanResult,
      reportRepository: {
        source: 'local',
        path: scanResult.rootPath,
      },
    };
  }

  if (repository.source === 'github') {
    const { githubRepositoryScanner } = await import(
      '../../repository/github-repository-scanner.service.js'
    );
    const scanResult = await githubRepositoryScanner.scan({
      installationId: repository.installationId,
      owner: repository.owner,
      repo: repository.repo,
      ref: repository.ref,
      scanMode,
    });

    return {
      repository,
      scanResult,
      reportRepository: {
        source: 'github',
        installationId: repository.installationId,
        owner: repository.owner,
        repo: repository.repo,
        pullNumber: repository.pullNumber,
        ref: repository.ref,
        headSha: repository.headSha || repository.ref,
        pullRequestUrl: repository.pullRequestUrl,
      },
    };
  }

  throw Object.assign(
    new Error(`Unsupported repository source: ${repository.source}`),
    {
      code: 'PHASE6_UNSUPPORTED_REPOSITORY_SOURCE',
    }
  );
}

function serializeDependencyGraph(graph) {
  return {
    summary: graph.summary,
    nodes: [...graph.nodes.values()].map(node => ({
      path: node.path,
      layer: node.layer,
      dependencies: node.dependencies,
      dependents: node.dependents,
      externalImports: node.externalImports,
      unresolvedImports: node.unresolvedImports,
    })),
    edges: graph.edges,
    externalDependencies: graph.externalDependencies,
    parseErrors: graph.parseErrors,
  };
}
