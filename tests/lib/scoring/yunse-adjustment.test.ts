import { describe, it, expect } from 'vitest';
import { computeYunseAdjustment } from '@/lib/scoring/yunseAdjustment';
import type { YunseCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

// §1.1 사용자 승인 대기: 가중치 비율, Δ 함수, 총 영향 범위
// GREEN 진입 전 approval 필요 — 현재 RED 단계

function makeYunse(overrides?: Partial<{
  daePillar: string;
  seyunPillar: string;
  wolunPillar: string;
  iliun: { today_pillar: string; today_date: string };
}>): YunseCore {
  return {
    daeun: {
      start_age: 7,
      list: [{ age: 7, pillar: overrides?.daePillar ?? '갑자', year: 2020 }],
      current_index: 0,
    },
    seyun: { current_pillar: overrides?.seyunPillar ?? '병오', current_year: 2026 },
    wolun: { current_pillar: overrides?.wolunPillar ?? '계사', current_month: '2026-05' },
    iliun: overrides?.iliun ?? { today_pillar: '갑자', today_date: '2026-05-07' },
  };
}

describe('computeYunseAdjustment (Phase Y3 — §1.1 승인 후 GREEN)', () => {
  const MODE: Mode = '일합';

  it('대운 천간이 상대 일주와 천간합 시 양수 가중치 반환 (갑기합)', () => {
    const yunse = makeYunse({ daePillar: '갑자' });   // 대운 甲
    const relationDayPillar = '기묘';                  // 일주 己 → 갑기합
    const result = computeYunseAdjustment(yunse, relationDayPillar, MODE);
    expect(result).toBeGreaterThan(0);
  });

  it('세운 지지가 상대 일주와 충 시 음수 가중치 반환 (자오충)', () => {
    const yunse = makeYunse({ seyunPillar: '병자' });  // 세운 子
    const relationDayPillar = '병오';                   // 일주 午 → 자오충
    const result = computeYunseAdjustment(yunse, relationDayPillar, MODE);
    expect(result).toBeLessThan(0);
  });

  it('결과는 항상 [-10, +10] 범위 (spec §6 clamp)', () => {
    const yunse = makeYunse({ daePillar: '갑자', seyunPillar: '갑자', wolunPillar: '갑자' });
    const result = computeYunseAdjustment(yunse, '기묘', MODE);
    expect(result).toBeGreaterThanOrEqual(-10);
    expect(result).toBeLessThanOrEqual(10);
  });

  it('동일 입력은 항상 동일 출력 (결정형 — ADR-035)', () => {
    const yunse = makeYunse();
    const a = computeYunseAdjustment(yunse, '병오', MODE);
    const b = computeYunseAdjustment(yunse, '병오', MODE);
    expect(a).toBe(b);
  });

  it('일운 today_pillar 가 다르면 결과가 달라진다 (일별 변동 반영)', () => {
    const yunse1 = makeYunse({ iliun: { today_pillar: '갑자', today_date: '2026-05-07' } });
    const yunse2 = makeYunse({ iliun: { today_pillar: '경오', today_date: '2026-05-08' } });
    const a = computeYunseAdjustment(yunse1, '기묘', MODE);
    const b = computeYunseAdjustment(yunse2, '기묘', MODE);
    expect(a).not.toBe(b);
  });

  it('mode 에 따라 가중치 배분이 달라진다 (일합 vs 친구합)', () => {
    const yunse = makeYunse({ daePillar: '갑자' });
    const a = computeYunseAdjustment(yunse, '기묘', '일합');
    const b = computeYunseAdjustment(yunse, '기묘', '친구합');
    // 두 모드는 다른 가중치를 가져야 함
    expect(a).not.toBe(b);
  });
});

describe('score_breakdown.yunse_adjustment 노출 (Phase Y3 통합)', () => {
  it('computeFinalScore 결과에 yunse_adjustment 필드가 존재한다', async () => {
    const { computeFinalScore } = await import('@/lib/scoring/final');
    const chart = {
      year_pillar: '갑자', month_pillar: '을축', day_pillar: '병인', hour_pillar: null,
      day_master_element: '화' as const,
      five_elements_counts: { 목: 2, 화: 1, 토: 1, 금: 0, 수: 2 },
      gender_normalized: 'M' as const,
      yunse: makeYunse(),
    };
    const result = computeFinalScore(chart, chart, '일합');
    expect(result).toHaveProperty('yunse_adjustment');
  });

  it('final score = clamp(base + yunse_adjustment, 0, 100)', async () => {
    const { computeFinalScore } = await import('@/lib/scoring/final');
    const chart = {
      year_pillar: '갑자', month_pillar: '을축', day_pillar: '병인', hour_pillar: null,
      day_master_element: '화' as const,
      five_elements_counts: { 목: 2, 화: 1, 토: 1, 금: 0, 수: 2 },
      gender_normalized: 'M' as const,
      yunse: makeYunse(),
    };
    const result = computeFinalScore(chart, chart, '일합');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(typeof result.yunse_adjustment).toBe('number');
  });
});
