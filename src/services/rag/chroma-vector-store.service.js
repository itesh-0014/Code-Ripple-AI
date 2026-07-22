import { ChromaClient } from 'chromadb';
import { ragConfig } from '../../config/rag.config.js';
import { embeddingService } from './embedding.service.js';
import { sanitizeCollectionName } from './repository-key.util.js';

class ChromaVectorStoreService {
  constructor() {
    this.client = null;
    this.collection = null;
  }

  getCollectionName() {
    const profile = embeddingService.getProfile();

    return sanitizeCollectionName(
      `${ragConfig.chroma.collectionPrefix}_${profile.provider}_${profile.model}_${profile.dimensions}`
    );
  }

  getClient() {
    if (!this.client) {
      this.client = new ChromaClient({
        host: ragConfig.chroma.host,
        port: ragConfig.chroma.port,
        ssl: ragConfig.chroma.ssl,
        tenant: ragConfig.chroma.tenant,
        database: ragConfig.chroma.database,
      });
    }

    return this.client;
  }

  async getCollection() {
    if (!this.collection) {
      const profile = embeddingService.getProfile();

      this.collection = await this.getClient().getOrCreateCollection({
        name: this.getCollectionName(),
        embeddingFunction: null,
        metadata: {
          system: 'gitsense-ai',
          purpose: 'repository-context-rag',
          embeddingProvider: profile.provider,
          embeddingModel: profile.model,
          embeddingDimensions: profile.dimensions,
        },
      });
    }

    return this.collection;
  }

  async resetRepositoryIndex(repoKey) {
    const collection = await this.getCollection();

    try {
      await collection.delete({
        where: {
          repoKey,
        },
      });
    } catch (error) {
      if (!isEmptyDeleteError(error)) {
        throw error;
      }
    }
  }

  async upsertChunks({ repository, repoKey, chunks, embeddings }) {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunk and embedding counts must match before Chroma upsert.');
    }

    const collection = await this.getCollection();
    const profile = embeddingService.getProfile();

    for (let index = 0; index < chunks.length; index += ragConfig.chroma.batchSize) {
      const chunkBatch = chunks.slice(index, index + ragConfig.chroma.batchSize);
      const embeddingBatch = embeddings.slice(index, index + ragConfig.chroma.batchSize);

      await collection.upsert({
        ids: chunkBatch.map(chunk => chunk.id),
        embeddings: embeddingBatch,
        documents: chunkBatch.map(chunk => chunk.rawContent),
        metadatas: chunkBatch.map(chunk => ({
          ...chunk.metadata,
          repoKey,
          repositorySource: repository.source,
          repositoryOwner: repository.owner || '',
          repositoryName: repository.repo || '',
          repositoryRef: repository.ref || '',
          repositoryPath: repository.path || '',
          embeddingProvider: profile.provider,
          embeddingModel: profile.model,
          embeddingDimensions: profile.dimensions,
          indexedAt: new Date().toISOString(),
        })),
      });
    }
  }

  async querySimilar({ repoKey, queryEmbedding, limit }) {
    const collection = await this.getCollection();
    const result = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: {
        repoKey,
      },
      include: ['documents', 'metadatas', 'distances'],
    });

    const ids = result.ids?.[0] || [];
    const documents = result.documents?.[0] || [];
    const metadatas = result.metadatas?.[0] || [];
    const distances = result.distances?.[0] || [];

    return ids.map((id, i) => ({
      id,
      document: documents[i] || '',
      metadata: metadatas[i] || {},
      distance: distances[i] !== undefined ? distances[i] : null,
    }));
  }

  async countRepositoryChunks(repoKey) {
    const collection = await this.getCollection();
    const result = await collection.get({
      where: {
        repoKey,
      },
      include: [],
    });

    return result.ids.length;
  }
}

function isEmptyDeleteError(error) {
  const message = error?.message || '';
  return /not found|does not exist|no records/i.test(message);
}

export const chromaVectorStoreService = new ChromaVectorStoreService();
