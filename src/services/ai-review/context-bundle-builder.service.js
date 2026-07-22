import { aiReviewConfig } from '../../config/ai-review.config.js';
import {
  classifyModuleLayer,
  normalizeRepoPath,
} from '../../utils/repository-path.util.js';

class ContextBundleBuilderService {
  build({
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
    const fileByPath = new Map(
      (scanResult?.files || []).map(file => [normalizeRepoPath(file.path), file])
    );
    const changedFileByPath = new Map(
      (changedFiles || []).map(file => [
        normalizeRepoPath(file.filename),
        file,
      ])
    );

    const changedFileContexts = (impact?.changedFiles || [])
      .slice(0, aiReviewConfig.context.maxChangedFiles)
      .map(changedFileImpact =>
        buildChangedFileContext({
          changedFileImpact,
          changedFile: changedFileByPath.get(changedFileImpact.filename),
          sourceFile: fileByPath.get(changedFileImpact.filename),
          graphNode: graph?.nodes?.get(changedFileImpact.filename),
        })
      );

    const affectedModules = (impact?.affectedModules || [])
      .slice(0, aiReviewConfig.context.maxAffectedModules)
      .map(module => ({
        path: module.path,
        layer: module.layer,
        distance: module.distance,
        reason: module.reason,
        changedFile: module.changedFile,
      }));

    const retrievedContext = buildRetrievedContext(context);
    const ruleEngine = buildRuleEngineContext(validation);
    const affectedSystems = inferAffectedSystems({
      changedFiles: changedFileContexts,
      affectedModules,
      riskSignals: impact?.riskSignals || [],
      ruleFindings: ruleEngine.findings,
    });

    return {
      phase: 'phase-5-context-bundle',
      generatedAt: new Date().toISOString(),
      repository,
      reviewIntent:
        'Architecture-aware MERN pull request review using dependency, RAG, and deterministic rule context.',
      reviewStrategy: buildReviewStrategy({
        reviewDepth,
        plannerDecision,
        executionPlan,
        architectureAnalysis,
      }),
      reviewScope: {
        changedFileCount: changedFileContexts.length,
        affectedModuleCount: impact?.summary?.affectedModuleCount || 0,
        affectedLayers: impact?.summary?.affectedLayers || [],
        maxPropagationDepth: impact?.summary?.maxPropagationDepth || 0,
      },
      changedFiles: changedFileContexts,
      dependencyFindings: buildDependencyFindings({
        graph,
        changedFiles: changedFileContexts,
      }),
      architecturalImpact: {
        summary: impact?.summary || {},
        affectedModules,
        propagationChains: (impact?.propagationChains || [])
          .slice(0, aiReviewConfig.context.maxPropagationChains)
          .map(chain => ({
            changedFile: chain.changedFile,
            affectedFile: chain.affectedFile,
            distance: chain.distance,
            chain: chain.chain,
          })),
        riskSignals: impact?.riskSignals || [],
      },
      affectedSystems,
      retrievedContext,
      ruleEngine,
    };
  }
}

function buildReviewStrategy({
  reviewDepth,
  plannerDecision,
  executionPlan,
  architectureAnalysis,
}) {
  return {
    reviewDepth: reviewDepth || plannerDecision?.reviewDepth || 'STANDARD',
    plannerRiskLevel: plannerDecision?.riskLevel || executionPlan?.riskLevel || null,
    plannerRiskScore: plannerDecision?.riskScore || executionPlan?.riskScore || null,
    requiredAgents: executionPlan?.requiredAgents || [],
    executionStrategy: executionPlan?.strategy || null,
    reasonCodes: executionPlan?.reasonCodes || [],
    architectureAnalysisAvailable: Boolean(architectureAnalysis),
  };
}

function buildChangedFileContext({
  changedFileImpact,
  changedFile,
  sourceFile,
  graphNode,
}) {
  const normalizedPath = changedFileImpact.filename;

  return {
    path: normalizedPath,
    status: changedFileImpact.status || changedFile?.status || 'unknown',
    layer: changedFileImpact.layer || classifyModuleLayer(normalizedPath),
    isSourceFile: Boolean(changedFileImpact.isSourceFile),
    inDependencyGraph: Boolean(changedFileImpact.inDependencyGraph),
    changeStats: {
      additions: changedFile?.additions || 0,
      deletions: changedFile?.deletions || 0,
      changes: changedFile?.changes || 0,
    },
    patch: truncateText(
      changedFile?.patch || '',
      aiReviewConfig.context.maxPatchCharacters
    ),
    sourceExcerpt: truncateText(
      sourceFile?.content || '',
      aiReviewConfig.context.maxFileCharacters
    ),
    imports: summarizeImportExports(changedFileImpact.imports || graphNode?.imports),
    exports: summarizeImportExports(changedFileImpact.exports || graphNode?.exports),
    directDependencies: changedFileImpact.directDependencies || [],
    directDependents: changedFileImpact.directDependents || [],
    affectedModules: (changedFileImpact.affectedModules || [])
      .slice(0, 12)
      .map(module => ({
        path: module.path,
        layer: module.layer,
        distance: module.distance,
        reason: module.reason,
      })),
  };
}

function buildDependencyFindings({ graph, changedFiles }) {
  return {
    graphSummary: graph?.summary || {},
    changedFileDependencyMap: changedFiles.map(file => ({
      path: file.path,
      layer: file.layer,
      directDependencies: file.directDependencies,
      directDependents: file.directDependents,
      affectedModuleCount: file.affectedModules.length,
    })),
    externalDependencies: Object.entries(graph?.externalDependencies || {})
      .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
      .slice(0, 20)
      .map(([packageName, importCount]) => ({
        packageName,
        importCount,
      })),
    parseErrors: (graph?.parseErrors || []).slice(0, 10),
  };
}

function buildRetrievedContext(context) {
  if (!context) {
    return {
      available: false,
      error: null,
      summary: {},
      chunks: [],
    };
  }

  if (context.error) {
    return {
      available: false,
      error: context.error,
      summary: context.summary || {},
      chunks: [],
    };
  }

  const chunks = (context.changedFiles || [])
    .flatMap(changedFile =>
      (changedFile.retrievedContext || []).map(chunk => ({
        changedFile: changedFile.filename,
        path: chunk.path,
        layer: chunk.layer,
        chunkType: chunk.chunkType,
        lines: `${chunk.lineStart}-${chunk.lineEnd}`,
        relevanceScore: roundScore(chunk.relevanceScore),
        reasons: chunk.reasons || [],
        symbols: chunk.symbols || [],
        imports: chunk.importSources || [],
        exports: chunk.exportedNames || [],
        content: truncateText(
          chunk.content || '',
          aiReviewConfig.context.maxContextChunkCharacters
        ),
      }))
    )
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, aiReviewConfig.context.maxRetrievedChunks);

  return {
    available: true,
    repositoryKey: context.repositoryKey,
    summary: context.summary || {},
    chunks,
  };
}

function buildRuleEngineContext(validation) {
  if (!validation) {
    return {
      available: false,
      summary: {},
      findings: [],
      ruleErrors: [],
    };
  }

  return {
    available: true,
    summary: validation.summary || {},
    findings: (validation.findings || [])
      .slice(0, aiReviewConfig.context.maxRuleFindings)
      .map(finding => ({
        ruleId: finding.ruleId,
        ruleName: finding.ruleName,
        severity: finding.severity,
        category: finding.category,
        scope: finding.scope,
        filePath: finding.filePath,
        line: finding.line,
        message: finding.message,
        evidence: finding.evidence || [],
        recommendation: finding.recommendation || null,
      })),
    ruleErrors: validation.ruleErrors || [],
  };
}

function inferAffectedSystems({
  changedFiles,
  affectedModules,
  riskSignals,
  ruleFindings,
}) {
  const systems = new Set();

  for (const item of [...changedFiles, ...affectedModules]) {
    getSystemsForLayer(item.layer).forEach(system => systems.add(system));
    getSystemsForPath(item.path).forEach(system => systems.add(system));
  }

  for (const signal of riskSignals) {
    if (signal.type === 'security-sensitive-change') {
      systems.add('authentication middleware');
      systems.add('protected APIs');
      systems.add('session validation');
    }

    if (signal.type === 'cross-layer-impact') {
      systems.add('cross-layer request workflow');
    }
  }

  for (const finding of ruleFindings) {
    if (finding.category === 'security') {
      systems.add('security boundary');
    }

    if (finding.category === 'data-validation') {
      systems.add('request validation and data integrity');
    }
  }

  return [...systems].sort();
}

function getSystemsForLayer(layer) {
  const layerMap = {
    'auth-security': [
      'authentication middleware',
      'authorization flow',
      'protected APIs',
      'session validation',
    ],
    api: ['Express API routes', 'controller workflow'],
    data: ['MongoDB data model', 'persistence layer'],
    'business-logic': ['service layer', 'business workflow'],
    'frontend-ui': ['React UI flow', 'client state'],
    configuration: ['runtime configuration'],
    'shared-utility': ['shared utility contract'],
    application: ['application module'],
  };

  return layerMap[layer] || ['application module'];
}

function getSystemsForPath(filePath = '') {
  const lowerPath = filePath.toLowerCase();
  const systems = [];

  if (/(auth|jwt|session|token)/.test(lowerPath)) {
    systems.push('authentication flow');
  }

  if (/(middleware)/.test(lowerPath)) {
    systems.push('middleware chain');
  }

  if (/(route|routes|controller|api)/.test(lowerPath)) {
    systems.push('HTTP API boundary');
  }

  if (/(model|schema|db|database|mongoose|mongo)/.test(lowerPath)) {
    systems.push('MongoDB persistence');
  }

  return systems;
}

function summarizeImportExports(items = []) {
  return items.slice(0, 25).map(item => ({
    source: item.source,
    name: item.name,
    kind: item.kind,
  }));
}

function truncateText(value, maxCharacters) {
  if (!value || value.length <= maxCharacters) {
    return value || '';
  }

  return `${value.slice(0, maxCharacters)}\n...[truncated ${value.length - maxCharacters} chars]`;
}

function roundScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number.parseFloat(value.toFixed(4));
}

export const contextBundleBuilderService = new ContextBundleBuilderService();
