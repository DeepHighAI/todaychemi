// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/kasi/client');
// ssaju: calculateSaju는 실제 구현 유지, lunarToSolar만 spy 가능하도록 factory mock
vi.mock('ssaju', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ssaju')>();
  return { ...actual, lunarToSolar: vi.fn().mockReturnValue({ year: 1990, month: 4, day: 15 }) };
});

import { fetchLunCalInfo } from '@/lib/kasi/client';
import { lunarToSolar } from 'ssaju';
import { computeChart, type ComputeInput } from '@/lib/chart/compute';
import type { KasiLunCalItem } from '@/lib/kasi/types';

const KASI_ITEM: KasiLunCalItem = {
  lunSecha: '庚午',
  lunWolgeon: '庚子',
  lunIljin: '壬子',
  lunYear: 1990,
  lunMonth: 2,
  lunDay: 19,
  lunLeapmonth: 'false',
};

const SOLAR_INPUT: ComputeInput = {
  entity_id: 'user-uuid-001',
  birth_date: '1990-04-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:30',
  gender: 'M',
  theory_profile_version: 'v1',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchLunCalInfo).mockResolvedValue(KASI_ITEM);
  vi.mocked(lunarToSolar).mockReturnValue({ year: 1990, month: 4, day: 15 });
});

describe('computeChart', () => {
  it('solar input → fetchLunCalInfo를 solar date로 호출', async () => {
    await computeChart(SOLAR_INPUT, 'test-service-key');

    expect(fetchLunCalInfo).toHaveBeenCalledWith(1990, 4, 15, 'test-service-key');
    expect(lunarToSolar).not.toHaveBeenCalled();
  });

  it('solar input → chart_core 반환 (year/month/day_pillar 포함)', async () => {
    const { chart_core } = await computeChart(SOLAR_INPUT, 'test-service-key');

    expect(chart_core.day_pillar).toBe('壬子');
    expect(chart_core.hour_pillar).not.toBeNull();
    expect(chart_core.gender_normalized).toBe('M');
  });

  it('solar input → 64자 hex chart_hash 반환', async () => {
    const { chart_hash } = await computeChart(SOLAR_INPUT, 'test-service-key');
    expect(chart_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('결정형 — 동일 input → 동일 chart_hash', async () => {
    const { chart_hash: h1 } = await computeChart(SOLAR_INPUT, 'test-service-key');
    const { chart_hash: h2 } = await computeChart(SOLAR_INPUT, 'test-service-key');
    expect(h1).toBe(h2);
  });

  it('다른 entity_id → 다른 chart_hash (같은 birth_date)', async () => {
    const { chart_hash: h1 } = await computeChart(SOLAR_INPUT, 'key');
    const { chart_hash: h2 } = await computeChart({ ...SOLAR_INPUT, entity_id: 'user-uuid-002' }, 'key');
    expect(h1).not.toBe(h2);
  });

  it('lunar input → lunarToSolar 호출 후 solar date로 KASI 요청', async () => {
    vi.mocked(lunarToSolar).mockReturnValue({ year: 1990, month: 4, day: 15 });

    await computeChart(
      { ...SOLAR_INPUT, birth_date: '1990-02-19', birth_date_calendar: 'lunar', is_lunar_leap: false },
      'key',
    );

    expect(lunarToSolar).toHaveBeenCalledWith(1990, 2, 19, false);
    expect(fetchLunCalInfo).toHaveBeenCalledWith(1990, 4, 15, 'key');
  });

  it('birth_time_knowledge="unknown" → hour_pillar null, 시간은 12:00 assumed', async () => {
    const { chart_core } = await computeChart(
      { ...SOLAR_INPUT, birth_time_knowledge: 'unknown', birth_time: null },
      'key',
    );
    expect(chart_core.hour_pillar).toBeNull();
  });

  it('KASI 실패 → throw 전파', async () => {
    vi.mocked(fetchLunCalInfo).mockRejectedValue(new Error('KASI timeout'));
    await expect(computeChart(SOLAR_INPUT, 'key')).rejects.toThrow('KASI timeout');
  });
});
