import { ragConfig } from '../../config/rag.config.js';
import { embeddingService } from './embedding.service.js';
import { chromaVectorStoreService } from './chroma-vector-store.service.js';
import { buildRepositoryKey } from './repository-key.util.js';

class SemanticRetrievalService {
  async searchRepository({
    repository,
    repoKey = null,
    query,
    limit = ragConfig.retrieval.defaultLimit,
    excludePaths = [],
  }) {
    const resolvedRepoKey = repoKey || buildRepositoryKey(repository);
    const queryEmbedding = await embeddingService.embedQuery(query);
    const rows = await chromaVectorStoreService.querySimilar({
      repoKey: resolvedRepoKey,
      queryEmbedding,
      limit: limit + excludePaths.length + 8,
    });

    const excludedPathSet = new Set(excludePaths);

    return rows
      .map(row => normalizeRetrievalResult(row))
      .filter(result => !excludedPathSet.has(result.path))
      .slice(0, limit);
  }
}

function normalizeRetrievalResult(row) {
  const metadata = row.metadata || {};
  const distance = row.distance ?? null;

  return {
    id: row.id,
    path: metadata.path,
    layer: metadata.layer,
    chunkType: metadata.chunkType,
    lineStart: metadata.lineStart,
    lineEnd: metadata.lineEnd,
    symbols: parseJsonArray(metadata.symbolsJson),
    importSources: parseJsonArray(metadata.importSourcesJson),
    exportedNames: parseJsonArray(metadata.exportedNamesJson),
    dependencies: parseJsonArray(metadata.dependenciesJson),
    dependents: parseJsonArray(metadata.dependentsJson),
    distance,
    similarityScore: distance === null ? null : 1 / (1 + Math.max(distance, 0)),
    content: row.document,
    metadata,
  };
}

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export const semanticRetrievalService = new SemanticRetrievalService();
