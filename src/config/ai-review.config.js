import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const GEMINI_MISSING_KEY_MESSAGE =
  'Gemini API key missing.\nPlease add GEMINI_API_KEY to your .env file.';

function parseInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function parseNumber(value, fallback) {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export const aiReviewConfig = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_REVIEW_MODEL || 'gemini-2.0-flash',
    apiBaseUrl:
      process.env.GEMINI_API_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta',
    temperature: parseNumber(process.env.GEMINI_REVIEW_TEMPERATURE, 0.2),
    maxOutputTokens: parseInteger(
      process.env.GEMINI_REVIEW_MAX_OUTPUT_TOKENS,
      4096
    ),
    timeoutMs: parseInteger(process.env.GEMINI_REVIEW_TIMEOUT_MS, 45000),
    maxRetries: parseInteger(process.env.GEMINI_REVIEW_MAX_RETRIES, 2),
    retryBaseDelayMs: parseInteger(
      process.env.GEMINI_REVIEW_RETRY_BASE_DELAY_MS,
      750
    ),
  },

  context: {
    maxChangedFiles: parseInteger(process.env.AI_REVIEW_MAX_CHANGED_FILES, 20),
    maxAffectedModules: parseInteger(
      process.env.AI_REVIEW_MAX_AFFECTED_MODULES,
      40
    ),
    maxPropagationChains: parseInteger(
      process.env.AI_REVIEW_MAX_PROPAGATION_CHAINS,
      20
    ),
    maxRuleFindings: parseInteger(process.env.AI_REVIEW_MAX_RULE_FINDINGS, 30),
    maxRetrievedChunks: parseInteger(
      process.env.AI_REVIEW_MAX_RETRIEVED_CHUNKS,
      24
    ),
    maxPatchCharacters: parseInteger(
      process.env.AI_REVIEW_MAX_PATCH_CHARS,
      6000
    ),
    maxFileCharacters: parseInteger(
      process.env.AI_REVIEW_MAX_FILE_CHARS,
      6000
    ),
    maxContextChunkCharacters: parseInteger(
      process.env.AI_REVIEW_MAX_CONTEXT_CHUNK_CHARS,
      2400
    ),
  },
};
