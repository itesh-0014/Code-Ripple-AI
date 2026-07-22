import {
  GEMINI_MISSING_KEY_MESSAGE,
  aiReviewConfig,
} from '../../config/ai-review.config.js';

export class GeminiConfigurationError extends Error {
  constructor(message = GEMINI_MISSING_KEY_MESSAGE) {
    super(message);
    this.name = 'GeminiConfigurationError';
    this.code = 'GEMINI_API_KEY_MISSING';
    this.retryable = false;
  }
}

export class GeminiApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'GeminiApiError';
    this.code = options.code || 'GEMINI_API_ERROR';
    this.status = options.status || null;
    this.retryable = Boolean(options.retryable);
    this.providerMessage = options.providerMessage || null;
    this.retryAfterMs = options.retryAfterMs || null;
  }
}

class GeminiAIService {
  validateConfiguration() {
    if (!aiReviewConfig.gemini.apiKey) {
      throw new GeminiConfigurationError();
    }
  }

  async generateStructuredReview({
    systemInstruction,
    userPrompt,
    responseSchema,
  }) {
    this.validateConfiguration();

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        candidateCount: 1,
        temperature: aiReviewConfig.gemini.temperature,
        maxOutputTokens: aiReviewConfig.gemini.maxOutputTokens,
      },
    };

    return this.withRetries(() => this.sendGenerateContentRequest(requestBody));
  }

  async withRetries(operation) {
    let lastError = null;

    for (let attempt = 0; attempt <= aiReviewConfig.gemini.maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!error.retryable || attempt >= aiReviewConfig.gemini.maxRetries) {
          throw error;
        }

        await delay(getRetryDelayMs(error, attempt));
      }
    }

    throw lastError;
  }

  async sendGenerateContentRequest(requestBody) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      aiReviewConfig.gemini.timeoutMs
    );

    let response;

    try {
      response = await fetch(this.buildGenerateContentUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': aiReviewConfig.gemini.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new GeminiApiError('Gemini API request timed out.', {
          code: 'GEMINI_TIMEOUT',
          retryable: true,
        });
      }

      throw new GeminiApiError(`Gemini API request failed: ${error.message}`, {
        code: 'GEMINI_NETWORK_ERROR',
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    const responseJson = parseJsonSafely(responseText);

    if (!response.ok) {
      throw buildHttpError({ response, responseJson, responseText });
    }

    return parseGenerateContentResponse(responseJson);
  }

  buildGenerateContentUrl() {
    const modelPath = aiReviewConfig.gemini.model.startsWith('models/')
      ? aiReviewConfig.gemini.model
      : `models/${aiReviewConfig.gemini.model}`;

    return `${aiReviewConfig.gemini.apiBaseUrl.replace(/\/+$/, '')}/${modelPath}:generateContent`;
  }
}

function parseGenerateContentResponse(responseJson) {
  const candidate = responseJson?.candidates?.[0];

  if (!candidate && responseJson?.promptFeedback?.blockReason) {
    throw new GeminiApiError(
      `Gemini blocked the review prompt: ${responseJson.promptFeedback.blockReason}`,
      {
        code: 'GEMINI_PROMPT_BLOCKED',
        retryable: false,
      }
    );
  }

  const responseText = (candidate?.content?.parts || [])
    .map(part => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!responseText) {
    throw new GeminiApiError(
      `Gemini returned no review text. Finish reason: ${candidate?.finishReason || 'unknown'}`,
      {
        code: 'GEMINI_EMPTY_RESPONSE',
        retryable: false,
      }
    );
  }

  return {
    json: parseModelJson(responseText),
    rawText: responseText,
    metadata: {
      provider: 'gemini',
      model: aiReviewConfig.gemini.model,
      modelVersion: responseJson.modelVersion || null,
      responseId: responseJson.responseId || null,
      finishReason: candidate?.finishReason || null,
      safetyRatings: candidate?.safetyRatings || [],
      usageMetadata: responseJson.usageMetadata || {},
    },
  };
}

function buildHttpError({ response, responseJson, responseText }) {
  const status = response.status;
  const providerMessage =
    responseJson?.error?.message || responseText || response.statusText;
  const retryAfterMs = parseRetryAfterHeader(response.headers.get('retry-after'));

  if (isInvalidKeyError(status, providerMessage)) {
    return new GeminiApiError(
      'Gemini API key was rejected. Verify GEMINI_API_KEY in your .env file.',
      {
        code: 'GEMINI_INVALID_API_KEY',
        status,
        retryable: false,
        providerMessage,
      }
    );
  }

  if (status === 429) {
    return new GeminiApiError(
      'Gemini quota or rate limit reached. Review not generated. Check your Gemini API quota/billing or retry later.',
      {
        code: 'GEMINI_QUOTA_EXCEEDED',
        status,
        retryable: true,
        providerMessage,
        retryAfterMs,
      }
    );
  }

  return new GeminiApiError(
    `Gemini API request failed (${status}): ${providerMessage}`,
    {
      code: 'GEMINI_HTTP_ERROR',
      status,
      retryable: status === 408 || status >= 500,
      providerMessage,
      retryAfterMs,
    }
  );
}

function parseModelJson(responseText) {
  const cleanedText = stripMarkdownFence(responseText);

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    throw new GeminiApiError(
      `Gemini returned invalid JSON review output: ${error.message}`,
      {
        code: 'GEMINI_INVALID_JSON',
        retryable: false,
        providerMessage: responseText.slice(0, 500),
      }
    );
  }
}

function stripMarkdownFence(value) {
  const trimmedValue = value.trim();
  const fenceMatch = trimmedValue.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenceMatch ? fenceMatch[1].trim() : trimmedValue;
}

function parseJsonSafely(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isInvalidKeyError(status, message = '') {
  return (
    status === 401 ||
    status === 403 ||
    /api key not valid|invalid api key|permission denied/i.test(message)
  );
}

function parseRetryAfterHeader(value) {
  if (!value) {
    return null;
  }

  const retryAfterSeconds = Number.parseInt(value, 10);

  if (Number.isFinite(retryAfterSeconds)) {
    return retryAfterSeconds * 1000;
  }

  const retryAfterDate = Date.parse(value);

  if (Number.isFinite(retryAfterDate)) {
    return Math.max(0, retryAfterDate - Date.now());
  }

  return null;
}

function getRetryDelayMs(error, attempt) {
  if (error.retryAfterMs) {
    return error.retryAfterMs;
  }

  return aiReviewConfig.gemini.retryBaseDelayMs * 2 ** attempt;
}

function delay(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

export const geminiAIService = new GeminiAIService();
