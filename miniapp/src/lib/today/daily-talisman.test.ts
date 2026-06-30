import { describe, expect, it } from 'vitest';

import { advanceStreak, buildDailyTalisman, dailyTalismanStorageKey } from './daily-talisman';
import type { ChartCore, SajuDerived } from '@/types/chart';

function makeChart(overrides: Partial<ChartCore> = {}): ChartCore {
  return {
    year_pillar: '甲子',
    month_pillar: '乙丑',
    day_pillar: '丙寅',
    hour_pillar: '丁卯',
    day_master_element: '화',
    five_elements_counts: { 목: 2, 화: 0, 토: 2, 금: 1, 수: 3 },
    gender_normalized: 'F',
    yunse: {
      daeun: { start_age: 8, list: [], current_index: 0 },
      seyun: { current_pillar: '丙午', current_year: 2026 },
      wolun: { current_pillar: '甲午', current_month: '2026-06' },
      iliun: { today_pillar: '병자', today_date: '2026-06-30' },
    },
    ...overrides,
  };
}

const YONGSIN: SajuDerived = {
  derived_version: 2,
  yongsin: { basis: '억부신약', primary: '목', secondary: ['수'], huisin: '수' },
  sinkang: { level: '신약', score: 38 },
};

describe('buildDailyTalisman', () => {
  it('같은 날짜와 차트에서는 같은 부적을 결정한다', () => {
    const chart = makeChart();

    expect(buildDailyTalisman(chart, '2026-06-30')).toEqual(
      buildDailyTalisman(chart, '2026-06-30'),
    );
  });

  it('파생 용신(yongsin.primary)이 있으면 그 기운을 오늘의 기운으로 쓴다', () => {
    // 최소 카운트는 화(0)지만 용신은 목 → 용신 우선.
    const talisman = buildDailyTalisman(makeChart({ derived: YONGSIN }), '2026-06-30');

    expect(talisman).not.toBeNull();
    expect(talisman?.element).toBe('목');
    expect(talisman?.guardLabel).toContain('가드 ON');
  });

  it('파생이 없으면(레거시 v2) 최소 카운트 오행으로 폴백한다', () => {
    const talisman = buildDailyTalisman(makeChart(), '2026-06-30');

    expect(talisman?.element).toBe('화');
  });

  it('용신 값이 유효하지 않으면 최소 카운트로 폴백한다', () => {
    const broken = { yongsin: { primary: 'INVALID' } } as unknown as SajuDerived;
    const talisman = buildDailyTalisman(makeChart({ derived: broken }), '2026-06-30');

    expect(talisman?.element).toBe('화');
  });

  it('five_elements_counts 가 없고 파생도 없으면 null 을 반환한다(크래시 가드)', () => {
    const noCounts = makeChart();
    // @ts-expect-error 런타임에서 API 가 필드를 누락한 비정상 상황 재현
    delete noCounts.five_elements_counts;

    expect(buildDailyTalisman(noCounts, '2026-06-30')).toBeNull();
  });

  it('모든 오행 카운트가 0이고 파생도 없으면 null 을 반환한다', () => {
    const allZero = makeChart({ five_elements_counts: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } });

    expect(buildDailyTalisman(allZero, '2026-06-30')).toBeNull();
  });

  it('완료 상태 키는 날짜별로 분리된다', () => {
    const chart = makeChart();

    expect(dailyTalismanStorageKey(chart, '2026-06-30')).not.toBe(
      dailyTalismanStorageKey(chart, '2026-07-01'),
    );
  });

  it('연속 봉인 streak: 어제 이어지면 +1, 끊기면 1, 오늘 중복은 멱등', () => {
    expect(advanceStreak(null, '2026-06-30')).toEqual({ count: 1, lastDate: '2026-06-30' });
    expect(advanceStreak({ count: 3, lastDate: '2026-06-30' }, '2026-07-01')).toEqual({
      count: 4,
      lastDate: '2026-07-01',
    });
    // 오늘 이미 반영 → 그대로(중복 봉인 방어)
    expect(advanceStreak({ count: 4, lastDate: '2026-07-01' }, '2026-07-01')).toEqual({
      count: 4,
      lastDate: '2026-07-01',
    });
    // 하루 이상 끊김 → 1로 리셋
    expect(advanceStreak({ count: 9, lastDate: '2026-06-28' }, '2026-07-01')).toEqual({
      count: 1,
      lastDate: '2026-07-01',
    });
  });

  it('같은 기운이라도 날짜에 따라 여러 변형이 돌아간다(반복 피로 완화, S4)', () => {
    const chart = makeChart({ derived: YONGSIN }); // 용신=목 고정
    const glyphs = new Set<string>();
    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-07-${String(day).padStart(2, '0')}`;
      const talisman = buildDailyTalisman(chart, date);
      if (talisman) glyphs.add(talisman.glyph);
    }

    // 오행별 변형이 2개에서 확장되어, 한 달이면 3종 이상이 노출된다.
    expect(glyphs.size).toBeGreaterThanOrEqual(3);
  });
});
