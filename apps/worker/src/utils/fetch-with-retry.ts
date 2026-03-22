import type { Logger } from "@signal-map/logger";

interface FetchWithRetryOptions {
  url: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  logger?: Logger;
}

export async function fetchWithRetry(
  options: FetchWithRetryOptions,
): Promise<Response> {
  const {
    url,
    headers = {},
    maxRetries = 3,
    retryDelayMs = 1000,
    timeoutMs = 30000,
    logger,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      // Retry on rate limit or server errors
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get("Retry-After");
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : retryDelayMs * Math.pow(2, attempt);

        if (attempt < maxRetries) {
          logger?.warn(
            { url, status: response.status, attempt, delayMs },
            "Retrying after error",
          );
          await sleep(delayMs);
          continue;
        }
      }

      // Non-retryable error
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} for ${url}`,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === "AbortError") {
        lastError = new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
      }

      if (attempt < maxRetries) {
        const delayMs = retryDelayMs * Math.pow(2, attempt);
        logger?.warn(
          { url, error: lastError.message, attempt, delayMs },
          "Retrying after exception",
        );
        await sleep(delayMs);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
