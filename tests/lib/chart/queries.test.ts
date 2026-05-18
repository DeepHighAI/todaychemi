import { describe, expect, it, vi } from 'vitest';
import {
  fetchLatestUserChart,
  fetchLatestUserChartForVersion,
  fetchLatestRelationChartForVersion,
} from '@/lib/chart/queries';

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

describe('fetchLatestUserChartForVersion', () => {
  function buildChain(resolvedValue: unknown) {
    const maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn();
    eq.mockReturnValue({ eq, order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    return { from, select, eq, order, limit, maybeSingle };
  }

  it('queries user_charts with select(chart_core,chart_hash), both eq calls, order desc, limit 1, maybeSingle', async () => {
    const { from, select, eq, order, limit, maybeSingle } = buildChain({ data: null, error: null });
    const supabase = { from } as never;

    await fetchLatestUserChartForVersion(supabase, 'user-1', 'v0.8');

    expect(from).toHaveBeenCalledWith('user_charts');
    expect(select).toHaveBeenCalledWith('chart_core, chart_hash');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eq).toHaveBeenCalledWith('theory_profile_version', 'v0.8');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(1);
    expect(maybeSingle).toHaveBeenCalled();
  });

  it('returns latest chart row (data passthrough)', async () => {
    const expected = { data: { chart_core: { day_pillar: '갑자' }, chart_hash: 'abc' }, error: null };
    const { from } = buildChain(expected);
    const supabase = { from } as never;

    const result = await fetchLatestUserChartForVersion(supabase, 'user-2', 'v0.8');
    expect(result).toEqual(expected);
  });

  it('returns { data: null, error: null } when no chart exists', async () => {
    const expected = { data: null, error: null };
    const { from } = buildChain(expected);
    const supabase = { from } as never;

    const result = await fetchLatestUserChartForVersion(supabase, 'user-3', 'v0.8');
    expect(result).toEqual(expected);
  });
});

describe('fetchLatestRelationChartForVersion', () => {
  function buildChain(resolvedValue: unknown) {
    const maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn();
    eq.mockReturnValue({ eq, order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    return { from, select, eq, order, limit, maybeSingle };
  }

  it('queries relation_charts with select(chart_core,chart_hash), both eq calls, order desc, limit 1, maybeSingle', async () => {
    const { from, select, eq, order, limit, maybeSingle } = buildChain({ data: null, error: null });
    const supabase = { from } as never;

    await fetchLatestRelationChartForVersion(supabase, 'rel-1', 'v0.8');

    expect(from).toHaveBeenCalledWith('relation_charts');
    expect(select).toHaveBeenCalledWith('chart_core, chart_hash');
    expect(eq).toHaveBeenCalledWith('relation_id', 'rel-1');
    expect(eq).toHaveBeenCalledWith('theory_profile_version', 'v0.8');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(1);
    expect(maybeSingle).toHaveBeenCalled();
  });

  it('returns latest relation chart row (data passthrough)', async () => {
    const expected = { data: { chart_core: { day_pillar: '경인' }, chart_hash: 'xyz' }, error: null };
    const { from } = buildChain(expected);
    const supabase = { from } as never;

    const result = await fetchLatestRelationChartForVersion(supabase, 'rel-2', 'v0.8');
    expect(result).toEqual(expected);
  });

  it('returns { data: null, error: null } when no chart exists', async () => {
    const expected = { data: null, error: null };
    const { from } = buildChain(expected);
    const supabase = { from } as never;

    const result = await fetchLatestRelationChartForVersion(supabase, 'rel-3', 'v0.8');
    expect(result).toEqual(expected);
  });
});
