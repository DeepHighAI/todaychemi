import { describe, it, expect, vi, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { buildKasiFixtures } from '@/lib/kasi/seed-runner';
import type { SeedInput } from '../../../scripts/lib/kasi-seed-inputs';
import type { KasiLunCalItem } from '@/lib/kasi/types';

const SOLAR_ITEM: KasiLunCalItem = {
  lunSecha: '庚午', lunWolgeon: '庚子', lunIljin: '壬子',
  lunYear: 1990, lunMonth: 2, lunDay: 19, lunLeapmonth: 'false',
};

const solarInput: SeedInput = {
  id: 'T001',
  category: 'normal',
  input: { year: 1990, month: 3, day: 15, hour: 14, minute: 30, gender: '남', calendar: 'solar' },
};

const lunarInput: SeedInput = {
  id: 'T002',
  category: 'edge',
  input: { year: 1990, month: 2, day: 19, hour: 8, minute: 0, gender: '여', calendar: 'lunar' },
};

describe('buildKasiFixtures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls fetchSolar once per solar input', async () => {
    const fetchSolar = vi.fn().mockResolvedValue(SOLAR_ITEM);
    const lunarToSolar = vi.fn();

    await buildKasiFixtures([solarInput], { fetchSolar, lunarToSolar });

    expect(fetchSolar).toHaveBeenCalledTimes(1);
    expect(fetchSolar).toHaveBeenCalledWith(1990, 3, 15);
  });

  it('attaches source: "kasi_authoritative" to each record', async () => {
    const fetchSolar = vi.fn().mockResolvedValue(SOLAR_ITEM);
    const { records } = await buildKasiFixtures([solarInput], { fetchSolar, lunarToSolar: vi.fn() });

    expect(records[0]?.expected.source).toBe('kasi_authoritative');
  });

  it('handles per-sample failure without aborting the batch', async () => {
    const fetchSolar = vi.fn()
      .mockRejectedValueOnce(new Error('KASI timeout'))
      .mockResolvedValueOnce(SOLAR_ITEM);

    const input2: SeedInput = { id: 'T003', category: 'normal', input: { ...solarInput.input, year: 2000 } };
    const { records, failures } = await buildKasiFixtures([solarInput, input2], {
      fetchSolar, lunarToSolar: vi.fn(),
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toBe('T001');
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('T003');
  });

  it('calls lunarToSolar first for lunar inputs then fetchSolar', async () => {
    const lunarToSolar = vi.fn().mockResolvedValue({ year: 1990, month: 3, day: 15 });
    const fetchSolar = vi.fn().mockResolvedValue(SOLAR_ITEM);

    await buildKasiFixtures([lunarInput], { fetchSolar, lunarToSolar });

    expect(lunarToSolar).toHaveBeenCalledWith(1990, 2, 19, false);
    expect(fetchSolar).toHaveBeenCalledWith(1990, 3, 15);
  });

  it('E016 leap=true is passed to lunarToSolar', async () => {
    const lunarToSolar = vi.fn().mockResolvedValue({ year: 1976, month: 10, day: 6 });
    const fetchSolar = vi.fn().mockResolvedValue(SOLAR_ITEM);
    const leapInput: SeedInput = {
      id: 'E016', category: 'edge',
      input: { year: 1976, month: 8, day: 15, hour: 8, minute: 0, gender: '여', calendar: 'lunar', leap: true },
    };

    await buildKasiFixtures([leapInput], { fetchSolar, lunarToSolar });

    expect(lunarToSolar).toHaveBeenCalledWith(1976, 8, 15, true);
  });

  it('skips inputs already in partialPath and reuses saved records', async () => {
    const partialPath = join(tmpdir(), `kasi_partial_test_${Date.now()}.json`);
    const existing = [{
      id: 'T001', category: 'normal', input: solarInput.input,
      expected: { year_pillar: '庚午', month_pillar: '庚子', day_pillar: '壬子', hour_pillar: '丁未', day_master_stem: '壬', five_elements_counts: { 목: 0, 화: 2, 토: 1, 금: 2, 수: 3 }, source: 'kasi_authoritative' },
    }];
    writeFileSync(partialPath, JSON.stringify(existing), 'utf-8');

    const fetchSolar = vi.fn().mockResolvedValue(SOLAR_ITEM);
    const input2: SeedInput = { id: 'T003', category: 'normal', input: { ...solarInput.input, year: 2000 } };

    await buildKasiFixtures([solarInput, input2], { fetchSolar, lunarToSolar: vi.fn(), partialPath });

    expect(fetchSolar).toHaveBeenCalledTimes(1); // only T003, T001 loaded from partial
    if (existsSync(partialPath)) unlinkSync(partialPath);
  });

  it('returns null hour_pillar when input has no hour', async () => {
    const noHourInput: SeedInput = {
      id: 'T004', category: 'normal',
      input: { year: 1990, month: 3, day: 15, hour: undefined as unknown as number, minute: 0, gender: '남', calendar: 'solar' },
    };
    const fetchSolar = vi.fn().mockResolvedValue(SOLAR_ITEM);
    const { records } = await buildKasiFixtures([noHourInput], { fetchSolar, lunarToSolar: vi.fn() });

    expect(records[0]?.expected.hour_pillar).toBeNull();
  });
});
