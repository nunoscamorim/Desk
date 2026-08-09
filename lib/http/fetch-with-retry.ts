/**
 * Outbound HTTP with bounded retries.
 *
 * Every integration on this dashboard is a read against somebody else's API, so
 * the common failure is a transient one — a dropped connection, a 502 from a
 * proxy, a brief rate limit — arriving on a display that polls once a minute and
 * shows a fallback in the meantime. Retrying those inside the request costs a
 * second and saves a whole poll cycle of wrong data.
 *
 * What is deliberately *not* retried matters just as much: a 4xx means the
 * request itself is wrong, and repeating it neither fixes anything nor is free.
 * 401 in particular is handled a layer up, where a fresh token can be minted —
 * retrying it blindly here would just burn the budget before that can happen.
 */

export type RetryOptions = {
  /** Identifies the caller in logs. */
  label: string;
  /** Total attempts including the first. */
  attempts?: number;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Ceiling for all attempts and waits combined. */
  budgetMs?: number;
};

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_BUDGET_MS = 12000;
const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 4000;

/** 408 and 429 are the two 4xx codes that describe a moment rather than a mistake. */
const isRetryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;

/**
 * Honors `Retry-After`, which may be either a delay in seconds or an HTTP date.
 * Servers under load use it to say when they will be ready; ignoring it and
 * backing off on our own schedule is how a rate limit turns into a longer one.
 */
function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** Exponential backoff with full jitter, so parallel callers do not retry in lockstep. */
const backoffMs = (attempt: number) => Math.random() * Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string | URL, init: RequestInit, options: RetryOptions): Promise<Response> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const remaining = deadline - Date.now();
    // Starting an attempt that cannot finish inside the budget just delays the
    // failure past the caller's own timeout.
    if (remaining <= 0) break;

    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)) });
      if (!isRetryableStatus(response.status) || attempt === attempts) return response;

      const wait = retryAfterMs(response) ?? backoffMs(attempt);
      if (Date.now() + wait >= deadline) return response;
      console.warn(`[http] ${options.label} returned ${response.status}, retrying in ${Math.round(wait)}ms (attempt ${attempt}/${attempts})`);
      await sleep(wait);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const wait = backoffMs(attempt);
      if (Date.now() + wait >= deadline) break;
      console.warn(`[http] ${options.label} failed (${error instanceof Error ? error.message : String(error)}), retrying in ${Math.round(wait)}ms (attempt ${attempt}/${attempts})`);
      await sleep(wait);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${options.label} request failed after ${attempts} attempts`);
}
