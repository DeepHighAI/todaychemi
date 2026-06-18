import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api/client';
import { useMeChart } from './use-me-chart';

const mockApiFetch = vi.mocked(apiFetch);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useMeChart', () => {
  it('chart 존재 → data = chart', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, chart: { day_pillar: '甲子' } } as never);
    const { result } = renderHook(() => useMeChart('tok'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ day_pillar: '甲子' });
  });

  it('chart null → data = null (확정 미등록)', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, chart: null } as never);
    const { result } = renderHook(() => useMeChart('tok'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('조회 실패 → isError (흡수하지 않고 throw)', async () => {
    mockApiFetch.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useMeChart('tok'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
