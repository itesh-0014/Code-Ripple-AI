import { ragConfig } from '../../config/rag.config.js';
import { normalizeRepoPath } from '../../utils/repository-path.util.js';
import { repositoryIndexingService } from './repository-indexing.service.js';
import { semanticRetrievalService } from './semantic-retrieval.service.js';
import { buildRepositoryKey } from './repository-key.util.js';

class ContextRetrievalService {
  async retrieveForPullRequest({
    repository,
    scanResult,
    graph,
    impact,
    changedFiles,
    ensureIndexed = true,
    resetIndex = true,
    retrievalMode = 'NORMAL',
    maxPerChangedFile = ragConfig.retrieval.maxPerChangedFile,
  }) {
    const repoKey = buildRepositoryKey(repository);
    const indexing = ensureIndexed
      ? await repositoryIndexingService.indexRepository({
          repository,
          scanResult,
          graph,
          reset: resetIndex,
        })
      : {
          repoKey,
          skipped: true,
        };

    const changedFileContexts = [];

    for (const changedFileImpact of impact.changedFiles) {
      if (!changedFileImpact.isSourceFile) {
        continue;
      }

      const filePath = normalizeRepoPath(changedFileImpact.filename);
      const sourceFile = scanResult.files.find(file => normalizeRepoPath(file.path) === filePath);
      const graphNode = graph.nodes.get(filePath);
      const changedFile = changedFiles.find(
        file => normalizeRepoPath(file.filename) === filePath
      );
      const structuralContext = buildStructuralContext(changedFileImpact);
      const query = buildChangedFileQuery({
        sourceFile,
        graphNode,
        changedFileImpact,
        changedFile,
      });

      const semanticResults = await semanticRetrievalService.searchRepository({
        repoKey,
        query,
        limit: maxPerChangedFile * 2,
        excludePaths: [filePath],
      });

      const retrievedContext = rankAndTrimResults({
        results: semanticResults,
        structuralContext,
        changedFileImpact,
        maxPerChangedFile,
      });

      changedFileContexts.push({
        filename: filePath,
        layer: changedFileImpact.layer,
        query,
        structuralContext,
        retrievedContext,
      });
    }

    return {
      phase: 'phase-3-context-retrieval',
      repositoryKey: repoKey,
      retrievalMode,
      indexing,
      changedFiles: changedFileContexts,
      summary: buildSummary(changedFileContexts),
    };
  }
}

function buildStructuralContext(changedFileImpact) {
  return {
    directDependencies: changedFileImpact.directDependencies || [],
    directDependents: changedFileImpact.directDependents || [],
    affectedModules: (changedFileImpact.affectedModules || []).map(module => ({
      path: module.path,
      layer: module.layer,
      distance: module.distance,
      reason: module.reason,
    })),
  };
}

function buildChangedFileQuery({
  sourceFile,
  graphNode,
  changedFileImpact,
  changedFile,
}) {
  return [
    `Changed file: ${changedFileImpact.filename}`,
    `Layer: ${changedFileImpact.layer}`,
    changedFile?.status ? `PR status: ${changedFile.status}` : null,
    graphNode?.imports?.length
      ? `Imports: ${graphNode.imports.map(item => item.source).join(', ')}`
      : null,
    graphNode?.exports?.length
      ? `Exports: ${graphNode.exports.map(item => item.name).join(', ')}`
      : null,
    changedFileImpact.directDependencies?.length
      ? `Direct dependencies: ${changedFileImpact.directDependencies.join(', ')}`
      : null,
    changedFileImpact.directDependents?.length
      ? `Direct dependents: ${changedFileImpact.directDependents.join(', ')}`
      : null,
    changedFile?.patch ? `Patch:\n${changedFile.patch}` : null,
    sourceFile?.content ? `File content:\n${sourceFile.content.slice(0, 12000)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function rankAndTrimResults({
  results,
  structuralContext,
  maxPerChangedFile,
}) {
  const directDependencySet = new Set(structuralContext.directDependencies);
  const directDependentSet = new Set(structuralContext.directDependents);
  const affectedModuleSet = new Set(
    structuralContext.affectedModules.map(module => module.path)
  );

  return results
    .map(result => {
      const reasons = [];
      let structuralBoost = 0;

      if (directDependencySet.has(result.path)) {
        reasons.push('direct dependency');
        structuralBoost += 0.3;
      }

      if (directDependentSet.has(result.path)) {
        reasons.push('direct dependent');
        structuralBoost += 0.25;
      }

      if (affectedModuleSet.has(result.path)) {
        reasons.push('affected module');
        structuralBoost += 0.2;
      }

      if (reasons.length === 0) {
        reasons.push('semantic similarity');
      }

      return {
        ...result,
        relevanceScore: (result.similarityScore || 0) + structuralBoost,
        reasons,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxPerChangedFile);
}

function buildSummary(changedFileContexts) {
  const uniqueRetrievedFiles = new Set(
    changedFileContexts.flatMap(item =>
      item.retrievedContext.map(context => context.path)
    )
  );

  return {
    changedFilesProcessed: changedFileContexts.length,
    retrievedChunks: changedFileContexts.reduce(
      (total, item) => total + item.retrievedContext.length,
      0
    ),
    uniqueRetrievedFiles: uniqueRetrievedFiles.size,
  };
}

export const contextRetrievalService = new ContextRetrievalService();
