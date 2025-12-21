import { logger } from "../logger.js";

/**
 * Configuration for exponential backoff retry.
 */
export interface RetryConfig {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Initial delay in milliseconds before first retry (default: 1000) */
    initialDelayMs?: number;
    /** Maximum delay in milliseconds (default: 8000) */
    maxDelayMs?: number;
    /** Multiplier for exponential backoff (default: 2) */
    backoffMultiplier?: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    backoffMultiplier: 2,
};

/**
 * Determines if an error is retryable based on common patterns.
 * Retries on rate limits (429), server errors (5xx), and network errors.
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Network errors
        if (
            message.includes("network") ||
            message.includes("timeout") ||
            message.includes("econnreset") ||
            message.includes("econnrefused") ||
            message.includes("socket hang up")
        ) {
            return true;
        }

        // Check for HTTP status codes in error
        const statusMatch = message.match(/\b(4\d\d|5\d\d)\b/);
        if (statusMatch) {
            const status = parseInt(statusMatch[1], 10);
            // Retry on rate limits (429) and server errors (5xx)
            return status === 429 || status >= 500;
        }

        // Check for status property on error object
        const errorWithStatus = error as Error & { status?: number };
        if (typeof errorWithStatus.status === "number") {
            const status = errorWithStatus.status;
            return status === 429 || status >= 500;
        }
    }

    return false;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry.
 *
 * @param fn - The async function to execute
 * @param context - Description of the operation for logging
 * @param config - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    context: string,
    config: RetryConfig = {}
): Promise<T> {
    const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
        ...DEFAULT_CONFIG,
        ...config,
    };

    let lastError: unknown;
    let delayMs = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const isLastAttempt = attempt === maxRetries;
            const shouldRetry = !isLastAttempt && isRetryableError(error);

            if (!shouldRetry) {
                logger.error(
                    { err: error, attempt: attempt + 1, context },
                    `${context} failed (non-retryable or max retries reached)`
                );
                throw error;
            }

            logger.warn(
                { err: error, attempt: attempt + 1, nextDelayMs: delayMs, context },
                `${context} failed, retrying in ${delayMs}ms...`
            );

            await sleep(delayMs);
            delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
}
