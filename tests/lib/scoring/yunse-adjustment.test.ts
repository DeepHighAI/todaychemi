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

describe('computeYunseAdjustment — 한자 인코딩 (프로덕션, SCORING_VERSION 2)', () => {
  const MODE: Mode = '일합';

  // makeYunse 기본값(한글)의 한자 등가 — daeun 甲子 / seyun 丙午 / wolun 癸巳 / iliun 甲子
  function makeHanjaYunse(overrides?: Partial<{
    daePillar: string;
    seyunPillar: string;
  }>): YunseCore {
    return makeYunse({
      daePillar: overrides?.daePillar ?? '甲子',
      seyunPillar: overrides?.seyunPillar ?? '丙午',
      wolunPillar: '癸巳',
      iliun: { today_pillar: '甲子', today_date: '2026-05-07' },
    });
  }

  it('회귀: 한자 yunse + 한자 relation day_pillar 천간합(甲己) → 양수 보정 (v1 에서 항상 0 이던 케이스)', () => {
    // ssaju yunse 한자 + KASI day_pillar 한자 — 프로덕션 인코딩 조합
    const result = computeYunseAdjustment(makeHanjaYunse(), '己卯', MODE);
    expect(result).toBeGreaterThan(0);
  });

  it('이중 인코딩 동치: 천간합 케이스 — 한자 입력 = 한글 입력 결과', () => {
    const hanja = computeYunseAdjustment(makeHanjaYunse(), '己卯', MODE);
    const hangul = computeYunseAdjustment(makeYunse({ daePillar: '갑자' }), '기묘', MODE);
    expect(hanja).toBe(hangul);
    expect(hanja).not.toBe(0);
  });

  it('이중 인코딩 동치: 지지충(子午) 케이스 — 한자 입력 = 한글 입력 결과 (음수)', () => {
    const hanja = computeYunseAdjustment(makeHanjaYunse({ seyunPillar: '丙子' }), '丙午', MODE);
    const hangul = computeYunseAdjustment(makeYunse({ seyunPillar: '병자' }), '병오', MODE);
    expect(hanja).toBe(hangul);
    expect(hanja).toBeLessThan(0);
  });

  it('혼합 인코딩: 한글 yunse + 한자 relation day_pillar 도 동일 결과 (스냅샷 픽스처 조합)', () => {
    const mixed = computeYunseAdjustment(makeYunse({ daePillar: '갑자' }), '己卯', MODE);
    const hangul = computeYunseAdjustment(makeYunse({ daePillar: '갑자' }), '기묘', MODE);
    expect(mixed).toBe(hangul);
    expect(mixed).toBeGreaterThan(0);
  });
});

// 리뷰 F8: 레거시 jsonb 변형 — current_index 범위 밖이어도 throw 없이 대운 항만 0 강등
describe('computeYunseAdjustment — daeun index 방어', () => {
  it('current_index 범위 밖 → throw 없이 숫자 반환 (대운 항 0)', () => {
    const yunse = makeYunse();
    const broken: YunseCore = {
      ...yunse,
      daeun: { ...yunse.daeun, current_index: 7 },
    };
    const result = computeYunseAdjustment(broken, '己巳', '일합');
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });

  it('빈 daeun list → throw 없이 숫자 반환', () => {
    const yunse = makeYunse();
    const broken: YunseCore = {
      ...yunse,
      daeun: { ...yunse.daeun, list: [], current_index: 0 },
    };
    expect(typeof computeYunseAdjustment(broken, '己巳', '일합')).toBe('number');
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
