type Provider = 'openai';

interface ProviderState {
  failures: number[];
  openUntilMs: number;
}

const FAILURE_WINDOW_MS = 5 * 60 * 1000;
const OPEN_DURATION_MS = 30 * 60 * 1000;
const FAILURE_THRESHOLD = 3;

const states: Record<Provider, ProviderState> = {
  openai: { failures: [], openUntilMs: 0 },
};

export function isProviderUnhealthy(provider: Provider, now = new Date()): boolean {
  return states[provider].openUntilMs > now.getTime();
}

export function recordProviderFailure(provider: Provider, now = new Date()): void {
  const state = states[provider];
  const cutoff = now.getTime() - FAILURE_WINDOW_MS;
  state.failures = [...state.failures.filter((ts) => ts >= cutoff), now.getTime()];
  if (state.failures.length >= FAILURE_THRESHOLD) {
    state.openUntilMs = now.getTime() + OPEN_DURATION_MS;
  }
}

export function recordProviderSuccess(provider: Provider): void {
  states[provider] = { failures: [], openUntilMs: 0 };
}

export function resetLlmCircuitBreakersForTest(): void {
  states.openai = { failures: [], openUntilMs: 0 };
}
