import { describe, it, expect } from 'vitest';
import {
  computeSipsin,
  computeSipsinScore,
  MODE_SIPSIN_AXIS,
  type Sipsin,
} from '@/lib/scoring/sipsin';
import type { ChartCore } from '@/types/chart';

function makeChart(
  year: string,
  month: string,
  day: string,
  hour: string | null = null,
): ChartCore {
  return {
    year_pillar: year,
    month_pillar: month,
    day_pillar: day,
    hour_pillar: hour,
    day_master_element: '목',
    five_elements_counts: { 목: 2, 화: 2, 토: 2, 금: 1, 수: 1 },
    gender_normalized: 'M',
    yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
  };
}

describe('computeSipsin (§3 십신 산출)', () => {
  // 갑(甲, 목양) 일간 기준 10간 전체 검증
  describe('甲 일간 기준', () => {
    it('甲→甲: 비견 (같은 오행 같은 음양)', () => {
      expect(computeSipsin('甲', '甲')).toBe('비견');
    });

    it('甲→乙: 겁재 (같은 오행 다른 음양)', () => {
      expect(computeSipsin('甲', '乙')).toBe('겁재');
    });

    it('甲→丙: 식신 (목이 화 생, 같은 음양=양)', () => {
      expect(computeSipsin('甲', '丙')).toBe('식신');
    });

    it('甲→丁: 상관 (목이 화 생, 다른 음양)', () => {
      expect(computeSipsin('甲', '丁')).toBe('상관');
    });

    it('甲→庚: 편관 (금이 목 극, 같은 음양=양)', () => {
      expect(computeSipsin('甲', '庚')).toBe('편관');
    });

    it('甲→辛: 정관 (금이 목 극, 다른 음양)', () => {
      expect(computeSipsin('甲', '辛')).toBe('정관');
    });

    it('甲→戊: 편재 (목이 토 극, 같은 음양=양)', () => {
      expect(computeSipsin('甲', '戊')).toBe('편재');
    });

    it('甲→己: 정재 (목이 토 극, 다른 음양)', () => {
      expect(computeSipsin('甲', '己')).toBe('정재');
    });

    it('甲→壬: 편인 (수가 목 생, 같은 음양=양)', () => {
      expect(computeSipsin('甲', '壬')).toBe('편인');
    });

    it('甲→癸: 정인 (수가 목 생, 다른 음양)', () => {
      expect(computeSipsin('甲', '癸')).toBe('정인');
    });
  });

  describe('乙 일간 기준 (음)', () => {
    it('乙→乙: 비견', () => expect(computeSipsin('乙', '乙')).toBe('비견'));
    it('乙→甲: 겁재', () => expect(computeSipsin('乙', '甲')).toBe('겁재'));
    it('乙→丁: 식신 (목→화, 乙음·丁음 = 같은 음양)', () => {
      expect(computeSipsin('乙', '丁')).toBe('식신');
    });
    it('乙→丙: 상관 (목→화, 乙음·丙양 = 다른 음양)', () => {
      expect(computeSipsin('乙', '丙')).toBe('상관');
    });
    it('乙→辛: 편관 (금 극 목, 乙음·辛음 = 같은 음양)', () => {
      expect(computeSipsin('乙', '辛')).toBe('편관');
    });
    it('乙→庚: 정관 (금 극 목, 乙음·庚양 = 다른 음양)', () => {
      expect(computeSipsin('乙', '庚')).toBe('정관');
    });
  });

  describe('丙 일간 기준 (화양)', () => {
    it('丙→甲: 편인 (목 생 화, 丙양·甲양 = 같은 음양)', () => {
      expect(computeSipsin('丙', '甲')).toBe('편인');
    });
    it('丙→壬: 편관 (수 극 화, 丙양·壬양 = 같은 음양)', () => {
      expect(computeSipsin('丙', '壬')).toBe('편관');
    });
    it('丙→戊: 식신 (화 생 토, 丙양·戊양 = 같은 음양)', () => {
      expect(computeSipsin('丙', '戊')).toBe('식신');
    });
  });
});

describe('MODE_SIPSIN_AXIS (§3.1 모드별 축 매핑)', () => {
  const MODES = ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'] as const;

  it('all 6 modes have an axis mapping', () => {
    for (const m of MODES) {
      expect(MODE_SIPSIN_AXIS).toHaveProperty(m);
      expect(['authority', 'execution', 'emotion', 'assets']).toContain(MODE_SIPSIN_AXIS[m]);
    }
  });

  it('일합 → authority (직장)', () => {
    expect(MODE_SIPSIN_AXIS['일합']).toBe('authority');
  });

  it('친구합 → emotion', () => {
    expect(MODE_SIPSIN_AXIS['친구합']).toBe('emotion');
  });

  it('돈합 → assets', () => {
    expect(MODE_SIPSIN_AXIS['돈합']).toBe('assets');
  });
});

describe('computeSipsinScore (§3.2 정규화)', () => {
  it('clamp 하한: 0', () => {
    // 겁재만 (-3 authority) × 4기둥 → sum = -12 → ((-12+30)/60)*100 = 30
    const self = makeChart('甲子', '甲子', '甲子', '甲子');
    // 관계: 乙乙乙乙 → 甲 기준 겁재 × 4
    const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
    const score = computeSipsinScore(self.day_pillar[0], rel, '일합');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('정관 × 4기둥 일합 → 높은 점수', () => {
    // 甲 일간 + 辛辛辛辛 (정관) × 4 → authority=12 × 4 = 48 → ((48+30)/60)*100 = 130 → clamped 100
    const self = makeChart('甲子', '甲子', '甲子', '甲子');
    const rel = makeChart('辛丑', '辛丑', '辛丑', '辛丑');
    const score = computeSipsinScore(self.day_pillar[0], rel, '일합');
    expect(score).toBe(100);
  });

  it('정인 × 4기둥 친구합 → emotion axis 적용', () => {
    // 甲 일간 + 癸癸癸癸 (정인) × 4 → emotion=10 × 4 = 40 → ((40+30)/60)*100 = ~116.67 → clamped 100
    const self = makeChart('甲子', '甲子', '甲子', '甲子');
    const rel = makeChart('癸亥', '癸亥', '癸亥', '癸亥');
    const score = computeSipsinScore(self.day_pillar[0], rel, '친구합');
    expect(score).toBe(100);
  });

  it('hour_pillar=null 이면 3기둥만 산정', () => {
    const self = makeChart('甲子', '甲子', '甲子');
    const rel3 = makeChart('辛丑', '辛丑', '辛丑', null); // 3 pillars
    const rel4 = makeChart('辛丑', '辛丑', '辛丑', '辛丑'); // 4 pillars
    const score3 = computeSipsinScore(self.day_pillar[0], rel3, '일합');
    const score4 = computeSipsinScore(self.day_pillar[0], rel4, '일합');
    // 4기둥이 더 높거나 같아야 함 (정관은 양수)
    expect(score4).toBeGreaterThanOrEqual(score3);
  });

  it('결과는 항상 [0, 100] 정수 범위', () => {
    const pairs: Array<[string, ChartCore, '일합']> = [
      ['甲', makeChart('乙丑', '乙丑', '乙丑'), '일합'],
      ['壬', makeChart('甲子', '甲子', '甲子'), '일합'],
    ];
    for (const [stem, rel, mode] of pairs) {
      const score = computeSipsinScore(stem, rel, mode);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
