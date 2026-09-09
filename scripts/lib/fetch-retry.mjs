const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 2000;
const DEFAULT_MIRROR_AFTER_ATTEMPTS = 2;
const MAX_ERROR_BODY_CHARS = 200;
const JITTER_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt, baseDelayMs) {
  return baseDelayMs * 2 ** (attempt - 1) + Math.random() * JITTER_MS;
}

function isRetryable(status) {
  return status === 429 || status >= 500;
}

async function failureWithBody(candidate, res) {
  let preview = "";
  try {
    preview = (await res.text()).replace(/\s+/g, " ").slice(0, MAX_ERROR_BODY_CHARS);
  } catch {
    preview = "";
  }
  const detail = preview ? `: ${preview}` : "";
  return new Error(`Failed to fetch ${candidate}: ${res.status} ${res.statusText}${detail}`);
}

// Fetch with exponential backoff for transient upstream failures
// (raw.githubusercontent.com throttles with 503 under load).
// Client errors (4xx except 429) skip retrying that source — retrying cannot help.
// retryOptions.mirrors lists fallback URLs tried after mirrorAfterAttempts
// primary failures, so a hard-down primary fails over in seconds instead of
// after the full retry budget.
export async function fetchWithRetry(url, fetchOptions, retryOptions = {}) {
  const maxAttempts = retryOptions.attempts ?? DEFAULT_ATTEMPTS;
  const baseDelayMs = retryOptions.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const mirrors = retryOptions.mirrors ?? [];
  const mirrorAfterAttempts = Math.min(
    retryOptions.mirrorAfterAttempts ?? DEFAULT_MIRROR_AFTER_ATTEMPTS,
    maxAttempts,
  );

  const firstPass = mirrors.length > 0 ? mirrorAfterAttempts : maxAttempts;
  const plan = [[url, firstPass]];
  for (const mirror of mirrors) plan.push([mirror, maxAttempts]);
  if (mirrors.length > 0 && firstPass < maxAttempts) plan.push([url, maxAttempts - firstPass]);

  let lastError = new Error(`Failed to fetch ${url}: all sources exhausted`);

  for (const [candidate, attempts] of plan) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let res;
      try {
        res = await fetch(candidate, fetchOptions);
      } catch (err) {
        lastError = err;
        if (attempt >= attempts) break;
        const delay = backoffDelay(attempt, baseDelayMs);
        console.warn(`  ! ${candidate} network error (attempt ${attempt}/${attempts}), retrying in ${Math.round(delay)}ms: ${err.message}`);
        await sleep(delay);
        continue;
      }

      if (res.ok) {
        if (candidate !== url) console.warn(`  ! ${url} failed, served from mirror ${candidate}`);
        return res;
      }

      lastError = await failureWithBody(candidate, res);
      if (!isRetryable(res.status) || attempt >= attempts) break;

      const delay = backoffDelay(attempt, baseDelayMs);
      console.warn(`  ! ${candidate} returned ${res.status} (attempt ${attempt}/${attempts}), retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}
