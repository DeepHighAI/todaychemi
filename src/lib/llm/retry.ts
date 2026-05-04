export interface RetryOptions {
  isRetryable: (err: unknown) => boolean;
}

export async function retryOnce<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  try {
    return await fn();
  } catch (firstErr) {
    if (!opts.isRetryable(firstErr)) {
      throw firstErr;
    }
    return await fn();
  }
}
