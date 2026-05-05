// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { deriveChartHash, type ChartHashInput } from '@/lib/chart/chart-hash';

const BASE: ChartHashInput = {
  entity_id: 'user-uuid-001',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  effective_birth_time: '14:30',
  gender: 'F',
  theory_profile_version: 'v1',
};

describe('deriveChartHash', () => {
  it('결정형 — 동일 input → 동일 hash', () => {
    expect(deriveChartHash(BASE)).toBe(deriveChartHash({ ...BASE }));
  });

  it('64자 hex 문자열', () => {
    const hash = deriveChartHash(BASE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('birth_date 변경 → 다른 hash', () => {
    expect(deriveChartHash(BASE)).not.toBe(deriveChartHash({ ...BASE, birth_date: '1991-03-16' }));
  });

  it('theory_profile_version 변경 → 다른 hash', () => {
    expect(deriveChartHash(BASE)).not.toBe(deriveChartHash({ ...BASE, theory_profile_version: 'v2' }));
  });

  it('effective_birth_time 변경 → 다른 hash', () => {
    expect(deriveChartHash(BASE)).not.toBe(deriveChartHash({ ...BASE, effective_birth_time: '09:00' }));
  });

  it('null birth_time vs "12:00" → 다른 hash', () => {
    expect(deriveChartHash({ ...BASE, effective_birth_time: null })).not.toBe(
      deriveChartHash({ ...BASE, effective_birth_time: '12:00' }),
    );
  });

  it('gender 변경 → 다른 hash', () => {
    expect(deriveChartHash(BASE)).not.toBe(deriveChartHash({ ...BASE, gender: 'M' }));
  });

  it('birth_date_calendar 변경 → 다른 hash', () => {
    expect(deriveChartHash(BASE)).not.toBe(deriveChartHash({ ...BASE, birth_date_calendar: 'lunar' }));
  });

  it('entity_id 변경 → 다른 hash (같은 birth_data여도 다른 entity)', () => {
    expect(deriveChartHash(BASE)).not.toBe(deriveChartHash({ ...BASE, entity_id: 'user-uuid-002' }));
  });
});
