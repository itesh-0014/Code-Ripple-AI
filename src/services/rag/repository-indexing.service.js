import { chunkingService } from './chunking.service.js';
import { embeddingService } from './embedding.service.js';
import { chromaVectorStoreService } from './chroma-vector-store.service.js';
import { buildRepositoryKey } from './repository-key.util.js';

class RepositoryIndexingService {
  async indexRepository({ repository, scanResult, graph, reset = true }) {
    const repoKey = buildRepositoryKey(repository);
    const chunks = chunkingService.chunkFiles({
      files: scanResult.files,
      graph,
      repositoryKey: repoKey,
    });

    if (reset) {
      await chromaVectorStoreService.resetRepositoryIndex(repoKey);
    }

    if (chunks.length === 0) {
      return {
        repoKey,
        chunksIndexed: 0,
        embeddingProfile: embeddingService.getProfile(),
      };
    }

    const embeddings = await embeddingService.embedDocuments(
      chunks.map(chunk => chunk.embeddingText)
    );

    await chromaVectorStoreService.upsertChunks({
      repository,
      repoKey,
      chunks,
      embeddings,
    });

    return {
      repoKey,
      chunksIndexed: chunks.length,
      filesIndexed: new Set(chunks.map(chunk => chunk.metadata.path)).size,
      collectionName: chromaVectorStoreService.getCollectionName(),
      embeddingProfile: embeddingService.getProfile(),
    };
  }
}

export const repositoryIndexingService = new RepositoryIndexingService();
