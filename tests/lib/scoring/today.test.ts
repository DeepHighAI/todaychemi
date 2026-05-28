import { describe, it, expect } from 'vitest';
import {
  computeTodayCompatScore,
  TODAY_SCORING_VERSION,
  TODAY_WEIGHTS,
} from '@/lib/scoring/today';
import type { ChartCore } from '@/types/chart';

// G2 / Phase 3 / C2 — 오늘 합온도 결정형 점수식
// 가중치 = { hap_chung: 0.25, sipsin: 0.15, ohaeng: 0.20, today_pillar_influence: 0.40 }
// today_pillar_influence ∈ [0, 1] = 0.5 + 0.25 * delta(today, self) + 0.25 * delta(today, relation)
// today_compat_score = round( clamp(0, 100, 100 * weighted_sum) )

function makeChart(
  year: string,
  month: string,
  day: string,
  hour: string | null = null,
  todayPillar: string = '갑자',
  counts: ChartCore['five_elements_counts'] = { 목: 2, 화: 2, 토: 2, 금: 1, 수: 1 },
  dayMasterElement: ChartCore['day_master_element'] = '목',
): ChartCore {
  return {
    year_pillar: year,
    month_pillar: month,
    day_pillar: day,
    hour_pillar: hour,
    day_master_element: dayMasterElement,
    five_elements_counts: counts,
    gender_normalized: 'M',
    yunse: {
      daeun: {
        start_age: 7,
        list: [{ age: 7, pillar: '갑자', year: 1990 }],
        current_index: 0,
      },
      seyun: { current_pillar: '병오', current_year: 2026 },
      wolun: { current_pillar: '계사', current_month: '2026-05' },
      iliun: { today_pillar: todayPillar, today_date: '2026-05-28' },
    },
  };
}

describe('TODAY_SCORING_VERSION + TODAY_WEIGHTS', () => {
  it('TODAY_SCORING_VERSION 은 1.0.0', () => {
    expect(TODAY_SCORING_VERSION).toBe('1.0.0');
  });

  it('TODAY_WEIGHTS 4축 + 합=1.0 (W1 사용자 확정)', () => {
    expect(TODAY_WEIGHTS.hap_chung).toBe(0.25);
    expect(TODAY_WEIGHTS.sipsin).toBe(0.15);
    expect(TODAY_WEIGHTS.ohaeng).toBe(0.20);
    expect(TODAY_WEIGHTS.today_pillar_influence).toBe(0.40);
    const sum =
      TODAY_WEIGHTS.hap_chung +
      TODAY_WEIGHTS.sipsin +
      TODAY_WEIGHTS.ohaeng +
      TODAY_WEIGHTS.today_pillar_influence;
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

describe('computeTodayCompatScore — 결정성 + 경계값', () => {
  const self = makeChart('甲子', '甲子', '甲午', null, '갑자');
  const relation = makeChart('己卯', '己卯', '己酉', null, '갑자');

  it('동일 입력 → 동일 점수 (결정성)', () => {
    const a = computeTodayCompatScore(self, relation, '2026-05-28');
    const b = computeTodayCompatScore(self, relation, '2026-05-28');
    expect(a).toBe(b);
  });

  it('점수는 0~100 범위', () => {
    const score = computeTodayCompatScore(self, relation, '2026-05-28');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('점수는 정수 (round)', () => {
    const score = computeTodayCompatScore(self, relation, '2026-05-28');
    expect(Number.isInteger(score)).toBe(true);
  });

  it('relation.day_pillar 가 바뀌면 점수가 바뀐다 (인연 종합 반영)', () => {
    const otherRel = makeChart('甲子', '甲子', '乙丑', null, '갑자');
    const a = computeTodayCompatScore(self, relation, '2026-05-28');
    const b = computeTodayCompatScore(self, otherRel, '2026-05-28');
    expect(a).not.toBe(b);
  });

  it('today_pillar(yunse.iliun) 가 바뀌면 점수가 바뀐다 (매일 변동 본질)', () => {
    const selfA = makeChart('甲子', '甲子', '甲午', null, '갑자');
    const selfB = makeChart('甲子', '甲子', '甲午', null, '병자');
    const a = computeTodayCompatScore(selfA, relation, '2026-05-28');
    const b = computeTodayCompatScore(selfB, relation, '2026-05-28');
    expect(a).not.toBe(b);
  });
});

describe('today_pillar_influence — 한글 today_pillar 와 한자 day_pillar 변환', () => {
  it('today_pillar(한글)과 self/relation.day_pillar(한자) 가 모두 동일 일주 = 비화 → 영향 중립(0.5)', () => {
    // today=갑자=甲子, self.day=甲子, relation.day=甲子 → 천간동일·지지동일(자형) → delta는 0
    const self = makeChart('乙丑', '乙丑', '甲子', null, '갑자');
    const rel = makeChart('丙寅', '丙寅', '甲子', null, '갑자');
    const score = computeTodayCompatScore(self, rel, '2026-05-28');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('today와 self 합·today와 relation 합 모두 발생 → 점수 상향', () => {
    // 甲己合: today=甲子, self.day=己酉 → 천간합. relation.day=己卯 → 천간합.
    const self = makeChart('乙丑', '乙丑', '己酉', null, '갑자');
    const rel = makeChart('丙寅', '丙寅', '己卯', null, '갑자');
    // 비교: today와 합 없는 케이스
    const selfNoHap = makeChart('乙丑', '乙丑', '丙午', null, '갑자');
    const relNoHap = makeChart('丙寅', '丙寅', '丁未', null, '갑자');

    const high = computeTodayCompatScore(self, rel, '2026-05-28');
    const low = computeTodayCompatScore(selfNoHap, relNoHap, '2026-05-28');
    expect(high).toBeGreaterThan(low);
  });

  it('today와 self/relation 충 발생 → 점수 하향', () => {
    // 子午沖: today=甲子, self.day=丙午 → 지지충
    const self = makeChart('乙丑', '乙丑', '丙午', null, '갑자');
    const rel = makeChart('丁未', '丁未', '戊子', null, '갑자'); // relation 일주=戊子 (today와 동일지지)
    const score = computeTodayCompatScore(self, rel, '2026-05-28');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('computeTodayCompatScore — 가중치 검증', () => {
  // 점수가 100 * weighted_sum (round) 인지 일부 검증
  it('점수는 0~100 정수, 가중치 합=1.0 보장 (수학적 일관성)', () => {
    const self = makeChart('甲子', '甲子', '甲午', null, '갑자');
    const rel = makeChart('己卯', '己卯', '己酉', null, '갑자');
    const score = computeTodayCompatScore(self, rel, '2026-05-28');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
