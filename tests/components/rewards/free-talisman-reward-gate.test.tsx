// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let mockPathname = '/feed';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { FreeTalismanRewardGate } from '@/components/rewards/free-talisman-reward-gate';

function renderGate(queryClient = new QueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <FreeTalismanRewardGate />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  mockPathname = '/feed';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, reward: { awarded: true } }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('FreeTalismanRewardGate', () => {
  it('calls session reward API once on authenticated app entry', async () => {
    renderGate();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/rewards/session', { method: 'POST' }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not call reward API on onboarding routes', async () => {
    mockPathname = '/onboarding/review';

    renderGate();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('invalidates wallet query when a reward was awarded', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderGate(queryClient);

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me-wallet'] }),
    );
  });
});
