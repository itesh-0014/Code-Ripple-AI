import { ragConfig } from '../../config/rag.config.js';
import { createStableHash } from '../../utils/hash.util.js';

class EmbeddingService {
  getProfile() {
    const provider = ragConfig.embeddings.provider;

    if (provider === 'openai') {
      return {
        provider,
        model: ragConfig.embeddings.openai.model,
        dimensions:
          ragConfig.embeddings.openai.dimensions ||
          inferOpenAIDimensions(ragConfig.embeddings.openai.model),
      };
    }

    if (provider === 'gemini') {
      return {
        provider,
        model: ragConfig.embeddings.gemini.model,
        dimensions: ragConfig.embeddings.gemini.dimensions,
      };
    }

    return {
      provider: 'local',
      model: 'local-token-hash-v1',
      dimensions: ragConfig.embeddings.localDimensions,
    };
  }

  async embedDocuments(texts) {
    return this.embedTexts(texts, { inputType: 'document' });
  }

  async embedQuery(text) {
    const [embedding] = await this.embedTexts([text], { inputType: 'query' });
    return embedding;
  }

  async embedTexts(texts, options = {}) {
    const provider = ragConfig.embeddings.provider;

    if (texts.length === 0) {
      return [];
    }

    if (provider === 'openai') {
      return this.embedWithOpenAI(texts);
    }

    if (provider === 'gemini') {
      return this.embedWithGemini(texts, options);
    }

    return texts.map(text => buildLocalEmbedding(text, this.getProfile().dimensions));
  }

  async embedWithOpenAI(texts) {
    const { apiKey, model, dimensions } = ragConfig.embeddings.openai;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when RAG_EMBEDDING_PROVIDER=openai');
    }

    return this.mapEmbeddingBatches(texts, async batch => {
      const body = {
        model,
        input: batch,
        encoding_format: 'float',
      };

      if (dimensions) {
        body.dimensions = dimensions;
      }

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI embedding request failed: ${response.status} ${await response.text()}`
        );
      }

      const data = await response.json();

      return data.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
    });
  }

  async embedWithGemini(texts) {
    const { apiKey, model, dimensions, taskType } = ragConfig.embeddings.gemini;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required when RAG_EMBEDDING_PROVIDER=gemini');
    }

    const modelName = model.replace(/^models\//, '');

    return this.mapEmbeddingBatches(texts, async batch => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:batchEmbedContents`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: batch.map(text => ({
              model: `models/${modelName}`,
              content: {
                parts: [{ text }],
              },
              task_type: taskType,
              output_dimensionality: dimensions,
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Gemini embedding request failed: ${response.status} ${await response.text()}`
        );
      }

      const data = await response.json();
      return data.embeddings.map(item => item.values);
    });
  }

  async mapEmbeddingBatches(texts, batchMapper) {
    const embeddings = [];

    for (let index = 0; index < texts.length; index += ragConfig.embeddings.batchSize) {
      const batch = texts.slice(index, index + ragConfig.embeddings.batchSize);
      embeddings.push(...(await batchMapper(batch)));
    }

    return embeddings;
  }
}

function inferOpenAIDimensions(model) {
  if (model.includes('large')) {
    return 3072;
  }

  return 1536;
}

function buildLocalEmbedding(text, dimensions) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenizeForLocalEmbedding(text);

  tokens.forEach((token, index) => {
    addTokenToVector(vector, token, 1);

    if (tokens[index + 1]) {
      addTokenToVector(vector, `${token}_${tokens[index + 1]}`, 0.35);
    }
  });

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map(value => value / magnitude);
}

function tokenizeForLocalEmbedding(text) {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 2)
    .slice(0, 3000);
}

function addTokenToVector(vector, token, weight) {
  const hash = createStableHash(token, 16);
  const bucket = Number.parseInt(hash.slice(0, 8), 16) % vector.length;
  const sign = Number.parseInt(hash.slice(8, 16), 16) % 2 === 0 ? 1 : -1;

  vector[bucket] += sign * weight;
}

export const embeddingService = new EmbeddingService();
