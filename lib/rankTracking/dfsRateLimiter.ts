/** Simple in-process rate limiter for DataForSEO calls. */

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

let active = 0;
const queue: Array<() => void> = [];

function drain(): void {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift();
    if (next) next();
  }
}

function isRetryable(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  return msg.includes('429') || msg.includes('throttl') || msg.includes('timeout') || msg.includes('econnreset');
}

export async function withDfsRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active += 1;
      (async () => {
        let lastErr: unknown;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
          try {
            const result = await fn();
            active -= 1;
            drain();
            resolve(result);
            return;
          } catch (e) {
            lastErr = e;
            if (!isRetryable(e) || attempt === MAX_RETRIES - 1) break;
            await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * (attempt + 1)));
          }
        }
        active -= 1;
        drain();
        reject(lastErr);
      })();
    };
    if (active < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}
