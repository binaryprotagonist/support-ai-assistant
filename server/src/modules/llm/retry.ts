export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOnErrors?: (err: any) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 300,
  maxDelayMs: 4000
};

export function isRetryableError(error: any): boolean {
  if (!error) return false;

  // Don't retry budget limit breaches or unrecoverable client errors (bad auth, invalid model, missing key)
  if (error.name === "BudgetExceededError") return false;
  const status = error.status || error.statusCode || error.response?.status;
  if (status === 400 || status === 401 || status === 403 || status === 404) return false;
  if (error.message?.includes("404") || error.message?.includes("API key") || error.message?.includes("not found")) return false;
  if (error.message?.includes("Quota exceeded") || error.message?.includes("quota") || error.message?.includes("free_tier_requests")) return false;

  // Check HTTP status codes
  if (status === 429) return true; // Rate limit
  if (status >= 500 && status <= 504) return true; // Server errors

  // Timeouts & Aborts
  if (error.name === "AbortError" || error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
    return true;
  }

  // Schema / JSON parse failures (can be fixed with a retry prompt)
  if (error.name === "SyntaxError" || error.name === "ZodError" || error.message?.includes("JSON")) {
    return true;
  }

  // Common network drop errors
  if (error.code === "ECONNRESET" || error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
    return true;
  }

  return false;
}


export function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number = 300,
  maxDelayMs: number = 4000
): number {
  // Full jitter: min(maxDelay, base * 2^attempt + random(0, base))
  const exponential = baseDelayMs * Math.pow(2, attempt);

  const jitter = Math.random() * baseDelayMs;
  
  return Math.min(maxDelayMs, exponential + jitter);
}


export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: Partial<RetryOptions> = {},
  onRetry?: (attempt: number, error: any, delayMs: number) => void
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } 
    catch (error: any) {
      lastError = error;

      if (attempt >= opts.maxRetries) {
        break;
      }

      const retryCheck = opts.retryOnErrors || isRetryableError;
      
      if (!retryCheck(error)) {
        throw error;
      }

      const delayMs = calculateBackoffWithJitter(attempt, opts.baseDelayMs, opts.maxDelayMs);
      
      if (onRetry) {
        onRetry(attempt + 1, error, delayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
