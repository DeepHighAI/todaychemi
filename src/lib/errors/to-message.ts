export function toErrorMessage(err: unknown, fallback = 'unknown error'): string {
  return err instanceof Error ? err.message : fallback;
}
