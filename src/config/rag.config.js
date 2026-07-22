import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function parseInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function inferEmbeddingProvider() {
  if (process.env.RAG_EMBEDDING_PROVIDER) {
    return process.env.RAG_EMBEDDING_PROVIDER;
  }

  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }

  if (process.env.GEMINI_API_KEY) {
    return 'gemini';
  }

  return 'local';
}

export const ragConfig = {
  enabled: process.env.RAG_ENABLED === 'true',

  chunking: {
    maxLines: parseInteger(process.env.RAG_CHUNK_MAX_LINES, 90),
    overlapLines: parseInteger(process.env.RAG_CHUNK_OVERLAP_LINES, 12),
    minChunkCharacters: parseInteger(process.env.RAG_MIN_CHUNK_CHARS, 80),
  },

  embeddings: {
    provider: inferEmbeddingProvider(),
    batchSize: parseInteger(process.env.RAG_EMBEDDING_BATCH_SIZE, 24),
    localDimensions: parseInteger(process.env.RAG_LOCAL_EMBEDDING_DIMENSIONS, 384),

    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      dimensions: process.env.OPENAI_EMBEDDING_DIMENSIONS
        ? parseInteger(process.env.OPENAI_EMBEDDING_DIMENSIONS, 1536)
        : null,
    },

    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
      dimensions: parseInteger(process.env.GEMINI_EMBEDDING_DIMENSIONS, 768),
      taskType: process.env.GEMINI_EMBEDDING_TASK_TYPE || 'SEMANTIC_SIMILARITY',
    },
  },

  chroma: {
    host: process.env.CHROMA_HOST || 'localhost',
    port: parseInteger(process.env.CHROMA_PORT, 8000),
    ssl: process.env.CHROMA_SSL === 'true',
    tenant: process.env.CHROMA_TENANT || 'default_tenant',
    database: process.env.CHROMA_DATABASE || 'default_database',
    collectionPrefix: process.env.CHROMA_COLLECTION_PREFIX || 'gitsense_repo_context',
    batchSize: parseInteger(process.env.CHROMA_UPSERT_BATCH_SIZE, 100),
  },

  retrieval: {
    defaultLimit: parseInteger(process.env.RAG_RETRIEVAL_LIMIT, 8),
    maxPerChangedFile: parseInteger(process.env.RAG_MAX_CONTEXT_PER_FILE, 8),
  },
};
