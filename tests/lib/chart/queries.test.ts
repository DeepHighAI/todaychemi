import { describe, expect, it, vi } from 'vitest';
import { fetchLatestUserChart } from '@/lib/chart/queries';

describe('fetchLatestUserChart', () => {
  it('queries user_charts with select(*), eq(user_id), order(created_at desc), limit(1), maybeSingle', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { chart_core: {} }, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as never;

    await fetchLatestUserChart(supabase, 'user-123');

    expect(from).toHaveBeenCalledWith('user_charts');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(1);
    expect(maybeSingle).toHaveBeenCalled();
  });

  it('returns the supabase query result (data + error passthrough)', async () => {
    const expected = { data: { chart_core: { day_pillar: '갑자' } }, error: null };
    const maybeSingle = vi.fn().mockResolvedValue(expected);
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as never;

    const result = await fetchLatestUserChart(supabase, 'user-456');
    expect(result).toEqual(expected);
  });

  it('passes through { data: null, error: null } when no chart exists', async () => {
    const expected = { data: null, error: null };
    const maybeSingle = vi.fn().mockResolvedValue(expected);
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as never;

    const result = await fetchLatestUserChart(supabase, 'user-789');
    expect(result).toEqual(expected);
  });
});
