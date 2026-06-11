import { describe, it, expect } from 'vitest';
import {
  SCORING_VERSION,
  STEM_HAP,
  BRANCH_HAP,
  SAMHAP,
  CHUNG,
  HYUNG_TRIPLES,
  HYUNG_SELF,
  HYUNG_SCORE,
  PA,
  HAE,
  SIPSIN_AXIS,
  MODE_WEIGHTS,
} from '@/lib/scoring/constants';

describe('SCORING_VERSION', () => {
  it('is 2 (v2: yunse 한자 인코딩 수정 2026-06-11)', () => {
    expect(SCORING_VERSION).toBe(2);
  });
});

describe('STEM_HAP (천간합 §2.1)', () => {
  it('has exactly 5 pairs', () => {
    expect(Object.keys(STEM_HAP)).toHaveLength(5);
  });

  it('갑기합 = +12', () => expect(STEM_HAP['甲己']).toBe(12));
  it('을경합 = +12', () => expect(STEM_HAP['乙庚']).toBe(12));
  it('병신합 = +12', () => expect(STEM_HAP['丙辛']).toBe(12));
  it('정임합 = +12', () => expect(STEM_HAP['丁壬']).toBe(12));
  it('무계합 = +12', () => expect(STEM_HAP['戊癸']).toBe(12));
});

describe('BRANCH_HAP (지지합 §2.2)', () => {
  it('has exactly 6 pairs', () => {
    expect(Object.keys(BRANCH_HAP)).toHaveLength(6);
  });

  it('자축합 = +10', () => expect(BRANCH_HAP['子丑']).toBe(10));
  it('인해합 = +10', () => expect(BRANCH_HAP['寅亥']).toBe(10));
  it('묘술합 = +10', () => expect(BRANCH_HAP['卯戌']).toBe(10));
  it('진유합 = +10', () => expect(BRANCH_HAP['辰酉']).toBe(10));
  it('사신합 = +10', () => expect(BRANCH_HAP['巳申']).toBe(10));
  it('오미합 = +10', () => expect(BRANCH_HAP['午未']).toBe(10));
});

describe('SAMHAP (삼합·반합 §2.3)', () => {
  it('has exactly 4 groups', () => {
    expect(SAMHAP).toHaveLength(4);
  });

  it('인오술 화국: fullScore=15, halfScore=8', () => {
    const group = SAMHAP.find((g) => g.full.includes('寅') && g.full.includes('午'));
    expect(group).toBeDefined();
    expect(group!.fullScore).toBe(15);
    expect(group!.halfScore).toBe(8);
    expect(group!.full).toContain('戌');
  });

  it('신자진 수국 존재', () => {
    const group = SAMHAP.find((g) => g.full.includes('申') && g.full.includes('子'));
    expect(group).toBeDefined();
    expect(group!.full).toContain('辰');
  });

  it('사유축 금국 존재', () => {
    const group = SAMHAP.find((g) => g.full.includes('巳') && g.full.includes('酉'));
    expect(group).toBeDefined();
    expect(group!.full).toContain('丑');
  });

  it('해묘미 목국 존재', () => {
    const group = SAMHAP.find((g) => g.full.includes('亥') && g.full.includes('卯'));
    expect(group).toBeDefined();
    expect(group!.full).toContain('未');
  });
});

describe('CHUNG (충 §2.4)', () => {
  it('has exactly 6 pairs', () => {
    expect(Object.keys(CHUNG)).toHaveLength(6);
  });

  it('all chung scores are -15', () => {
    for (const score of Object.values(CHUNG)) {
      expect(score).toBe(-15);
    }
  });

  it('자오충 = -15', () => expect(CHUNG['子午']).toBe(-15));
  it('인신충 = -15', () => expect(CHUNG['寅申']).toBe(-15));
  it('묘유충 = -15', () => expect(CHUNG['卯酉']).toBe(-15));
  it('진술충 = -15', () => expect(CHUNG['辰戌']).toBe(-15));
  it('사해충 = -15', () => expect(CHUNG['巳亥']).toBe(-15));
});

describe('HYUNG (형 §2.4)', () => {
  it('HYUNG_SCORE is -10', () => {
    expect(HYUNG_SCORE).toBe(-10);
  });

  it('has 2 삼형 triples', () => {
    expect(HYUNG_TRIPLES).toHaveLength(2);
  });

  it('인사신 삼형 존재', () => {
    const group = HYUNG_TRIPLES.find((t) => t.includes('寅') && t.includes('巳'));
    expect(group).toBeDefined();
    expect(group).toContain('申');
  });

  it('축술미 삼형 존재', () => {
    const group = HYUNG_TRIPLES.find((t) => t.includes('丑') && t.includes('戌'));
    expect(group).toBeDefined();
    expect(group).toContain('未');
  });

  it('자형 set has 4 branches', () => {
    expect(HYUNG_SELF.size).toBe(4);
  });

  it('자자·오오·유유·진진 자형 존재', () => {
    expect(HYUNG_SELF.has('子')).toBe(true);
    expect(HYUNG_SELF.has('午')).toBe(true);
    expect(HYUNG_SELF.has('酉')).toBe(true);
    expect(HYUNG_SELF.has('辰')).toBe(true);
  });
});

describe('PA (파 §2.4)', () => {
  it('has exactly 6 pairs', () => {
    expect(Object.keys(PA)).toHaveLength(6);
  });

  it('all pa scores are -5', () => {
    for (const score of Object.values(PA)) {
      expect(score).toBe(-5);
    }
  });

  it('자유파 = -5', () => expect(PA['子酉']).toBe(-5));
  it('인해파 = -5', () => expect(PA['寅亥']).toBe(-5));
  it('사신파 = -5', () => expect(PA['巳申']).toBe(-5));
});

describe('HAE (해 §2.4)', () => {
  it('has exactly 6 pairs', () => {
    expect(Object.keys(HAE)).toHaveLength(6);
  });

  it('all hae scores are -5', () => {
    for (const score of Object.values(HAE)) {
      expect(score).toBe(-5);
    }
  });

  it('자미해 = -5', () => expect(HAE['子未']).toBe(-5));
  it('묘진해 = -5', () => expect(HAE['卯辰']).toBe(-5));
  it('신해해 = -5', () => expect(HAE['申亥']).toBe(-5));
});

describe('SIPSIN_AXIS (십신 축 §3.1)', () => {
  const ALL_SIPSIN = ['정관', '편관', '식신', '상관', '정재', '편재', '정인', '편인', '비견', '겁재'];

  it('has all 10 sipsin', () => {
    for (const s of ALL_SIPSIN) {
      expect(SIPSIN_AXIS).toHaveProperty(s);
    }
  });

  it('정관: authority=12, execution=5, emotion=3, assets=5', () => {
    expect(SIPSIN_AXIS['정관']).toEqual({ authority: 12, execution: 5, emotion: 3, assets: 5 });
  });

  it('편관: authority=8, execution=10, emotion=-3, assets=3', () => {
    expect(SIPSIN_AXIS['편관']).toEqual({ authority: 8, execution: 10, emotion: -3, assets: 3 });
  });

  it('식신: authority=5, execution=8, emotion=10, assets=5', () => {
    expect(SIPSIN_AXIS['식신']).toEqual({ authority: 5, execution: 8, emotion: 10, assets: 5 });
  });

  it('정재: authority=5, execution=8, emotion=5, assets=12', () => {
    expect(SIPSIN_AXIS['정재']).toEqual({ authority: 5, execution: 8, emotion: 5, assets: 12 });
  });

  it('겁재: authority=-3, execution=3, emotion=3, assets=-3', () => {
    expect(SIPSIN_AXIS['겁재']).toEqual({ authority: -3, execution: 3, emotion: 3, assets: -3 });
  });

  it('each entry has all 4 axes', () => {
    for (const s of ALL_SIPSIN) {
      const axes = SIPSIN_AXIS[s];
      expect(axes).toHaveProperty('authority');
      expect(axes).toHaveProperty('execution');
      expect(axes).toHaveProperty('emotion');
      expect(axes).toHaveProperty('assets');
    }
  });
});

describe('MODE_WEIGHTS (6모드 가중치 §6)', () => {
  const MODES = ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'] as const;

  it('has all 6 modes', () => {
    for (const m of MODES) {
      expect(MODE_WEIGHTS).toHaveProperty(m);
    }
  });

  it('each mode weights sum to 1.0', () => {
    for (const m of MODES) {
      const w = MODE_WEIGHTS[m];
      const sum = w.hap + w.sipsin + w.ohaeng;
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });

  it('일합: hap=0.35, sipsin=0.40, ohaeng=0.25', () => {
    expect(MODE_WEIGHTS['일합']).toEqual({ hap: 0.35, sipsin: 0.40, ohaeng: 0.25 });
  });

  it('친구합: hap=0.45, sipsin=0.25, ohaeng=0.30', () => {
    expect(MODE_WEIGHTS['친구합']).toEqual({ hap: 0.45, sipsin: 0.25, ohaeng: 0.30 });
  });

  it('첫합: hap=0.50, sipsin=0.20, ohaeng=0.30', () => {
    expect(MODE_WEIGHTS['첫합']).toEqual({ hap: 0.50, sipsin: 0.20, ohaeng: 0.30 });
  });

  it('오래합: hap=0.40, sipsin=0.25, ohaeng=0.35', () => {
    expect(MODE_WEIGHTS['오래합']).toEqual({ hap: 0.40, sipsin: 0.25, ohaeng: 0.35 });
  });

  it('each mode has hap, sipsin, ohaeng keys', () => {
    for (const m of MODES) {
      const w = MODE_WEIGHTS[m];
      expect(typeof w.hap).toBe('number');
      expect(typeof w.sipsin).toBe('number');
      expect(typeof w.ohaeng).toBe('number');
    }
  });
});
