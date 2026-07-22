const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class WebhookClient {
  constructor({
    provider,
    fetchImpl = globalThis.fetch,
    maxRetries = 2,
    timeoutMs = 5000,
    sleep = delay,
  }) {
    this.provider = provider;
    this.fetchImpl = fetchImpl;
    this.maxRetries = Math.max(0, maxRetries);
    this.timeoutMs = Math.max(1, timeoutMs);
    this.sleep = sleep;
  }

  async send(webhookUrl, payload) {
    validateWebhookUrl(webhookUrl, this.provider);

    if (typeof this.fetchImpl !== 'function') {
      throw createWebhookError(`${this.provider} fetch client is unavailable.`, {
        code: 'NOTIFICATION_CLIENT_UNAVAILABLE',
        retryable: false,
      });
    }

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.post(webhookUrl, payload);

        if (response.ok) {
          return {
            status: 'published',
            provider: this.provider,
            statusCode: response.status,
            attempts: attempt + 1,
          };
        }

        const retryable = RETRYABLE_STATUS_CODES.has(response.status);
        const responseBody = await readResponseBody(response);
        lastError = createWebhookError(
          `${this.provider} webhook returned HTTP ${response.status}.`,
          {
            code: classifyStatusCode(response.status),
            status: response.status,
            retryable,
            responseBody,
          }
        );

        if (!retryable || attempt === this.maxRetries) {
          throw lastError;
        }

        await this.sleep(calculateRetryDelay(response, attempt));
      } catch (error) {
        lastError = normalizeWebhookError(error, this.provider);

        if (!lastError.retryable || attempt === this.maxRetries) {
          throw lastError;
        }

        await this.sleep(calculateRetryDelay(null, attempt));
      }
    }

    throw lastError;
  }

  async post(webhookUrl, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function validateWebhookUrl(webhookUrl, provider = 'notification') {
  let parsed;

  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw createWebhookError(`Invalid ${provider} webhook URL.`, {
      code: 'INVALID_WEBHOOK_URL',
      retryable: false,
    });
  }

  const localHttp =
    parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);

  if (parsed.protocol !== 'https:' && !localHttp) {
    throw createWebhookError(`${provider} webhook URL must use HTTPS.`, {
      code: 'INSECURE_WEBHOOK_URL',
      retryable: false,
    });
  }
}

function normalizeWebhookError(error, provider) {
  if (error.code) {
    return error;
  }

  const aborted = error.name === 'AbortError';

  return createWebhookError(
    aborted
      ? `${provider} webhook request timed out.`
      : `${provider} webhook request failed: ${error.message}`,
    {
      code: aborted ? 'NOTIFICATION_TIMEOUT' : 'NOTIFICATION_NETWORK_ERROR',
      retryable: true,
      cause: error,
    }
  );
}

function createWebhookError(message, details = {}) {
  const error = new Error(message);
  error.name = 'NotificationWebhookError';
  error.code = details.code || 'NOTIFICATION_WEBHOOK_ERROR';
  error.status = details.status || null;
  error.retryable = Boolean(details.retryable);
  error.responseBody = details.responseBody || null;
  error.cause = details.cause;
  return error;
}

function classifyStatusCode(status) {
  if (status === 429) return 'NOTIFICATION_RATE_LIMITED';
  if (status >= 500) return 'NOTIFICATION_PROVIDER_UNAVAILABLE';
  if (status === 401 || status === 403) return 'NOTIFICATION_AUTH_FAILED';
  return 'NOTIFICATION_WEBHOOK_REJECTED';
}

function calculateRetryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));

  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return retryAfter * 1000;
  }

  return Math.min(250 * (2 ** attempt), 2000);
}

async function readResponseBody(response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
