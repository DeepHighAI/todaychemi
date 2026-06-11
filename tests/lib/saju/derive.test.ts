import { describe, it, expect } from 'vitest';

import { deriveSaju } from '@/lib/saju/derive';
import { splitPillar, STEM_INFO, BRANCH_INFO, type Element5 } from '@/lib/saju/ganji';
import { SIPSIN_NAMES } from '@/lib/saju/sipsin';

import type { RawFixtureEntry } from '../scoring/_fixtureAdapter';
import fixture from '../../fixtures/kasi_reference_100.json';

const entries = fixture as RawFixtureEntry[];

// 픽스처 expected 4기둥 → deriveSaju 입력
function toPillars(entry: RawFixtureEntry) {
  return {
    year_pillar: entry.expected.year_pillar,
    month_pillar: entry.expected.month_pillar,
    day_pillar: entry.expected.day_pillar,
    hour_pillar: entry.expected.hour_pillar,
  };
}

describe('deriveSaju — 골든 100 픽스처 sweep', () => {
  it('픽스처가 100건이다', () => {
    expect(entries).toHaveLength(100);
  });

  it('100건 전수: throw 없이 파생층 생성', () => {
    for (const entry of entries) {
      expect(() => deriveSaju(toPillars(entry))).not.toThrow();
    }
  });

  it('ohaeng_weighted: 음이 아닌 정수(-0 금지), 합은 4기둥 기준 80~112', () => {
    for (const entry of entries) {
      const derived = deriveSaju(toPillars(entry));
      const values = Object.values(derived.ohaeng_weighted);
      for (const v of values) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(Object.is(v, -0)).toBe(false);
      }
      // 기둥당 천간 10 + 정기 10(필수) + 중기 5/여기 3(선택) → 20~28, 4기둥 = 80~112
      const total = values.reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(80);
      expect(total).toBeLessThanOrEqual(112);
    }
  });

  it('sipsin counts: 10키 전부 존재, 합 == 글자 수 − 1 (시有 8글자 → 7)', () => {
    for (const entry of entries) {
      const derived = deriveSaju(toPillars(entry));
      expect(Object.keys(derived.sipsin.counts).sort()).toEqual([...SIPSIN_NAMES].sort());
      const sum = Object.values(derived.sipsin.counts).reduce((a, b) => a + b, 0);
      expect(sum).toBe(7);
    }
  });

  it('표면 오행 집계가 expected.five_elements_counts와 정합 (ganji 테이블 교차 불변식)', () => {
    for (const entry of entries) {
      const surface: Record<Element5, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
      const { year_pillar, month_pillar, day_pillar, hour_pillar } = toPillars(entry);
      for (const pillar of [year_pillar, month_pillar, day_pillar, hour_pillar]) {
        const { stem, branch } = splitPillar(pillar);
        surface[STEM_INFO[stem].element] += 1;
        surface[BRANCH_INFO[branch].element] += 1;
      }
      expect(surface).toEqual(entry.expected.five_elements_counts);
    }
  });

  it('hour_known·yinyang·sinkang·yongsin·ilju 기본 불변식', () => {
    for (const entry of entries) {
      const derived = deriveSaju(toPillars(entry));
      expect(derived.derived_version).toBe(1);
      expect(derived.hour_known).toBe(true);
      expect(derived.yinyang_balance.yang + derived.yinyang_balance.yin).toBe(8);
      expect(['신강', '중화', '신약']).toContain(derived.sinkang.level);
      expect(['목', '화', '토', '금', '수']).toContain(derived.yongsin.primary);
      expect(derived.ilju.pillar).toBe(entry.expected.day_pillar);
    }
  });
});

describe('deriveSaju — N001 손계산 골든 (庚午 己卯 己卯 辛未, 일간 己)', () => {
  const derived = deriveSaju({
    year_pillar: '庚午',
    month_pillar: '己卯',
    day_pillar: '己卯',
    hour_pillar: '辛未',
  });

  it('슬롯별 십신', () => {
    expect(derived.sipsin.year).toEqual({ stem: '상관', branch: '편인' });
    expect(derived.sipsin.month).toEqual({ stem: '비견', branch: '편관' });
    expect(derived.sipsin.day).toEqual({ stem: '일간', branch: '편관' });
    expect(derived.sipsin.hour).toEqual({ stem: '식신', branch: '비견' });
  });

  it('ohaeng_weighted 손계산 (수=0 포함 — 0값 허용 확인)', () => {
    // 천간 庚금10 己토10 己토10 辛금10 / 지장간 午{己5,丁10} 卯{乙10}×2 未{丁3,乙5,己10}
    expect(derived.ohaeng_weighted).toEqual({ 목: 25, 화: 13, 토: 35, 금: 20, 수: 0 });
  });

  it('띠·일주', () => {
    expect(derived.tti).toEqual({ branch: '오', animal_ko: '말' });
    expect(derived.ilju).toEqual({ pillar: '己卯', gapja_index: 15, ko: '기묘' });
  });

  it('한글 독음 기둥 입력도 normalizeGanji 경유로 동일 결과', () => {
    const ko = deriveSaju({
      year_pillar: '경오',
      month_pillar: '기묘',
      day_pillar: '기묘',
      hour_pillar: '신미',
    });
    expect(ko).toEqual(derived);
  });
});

describe('deriveSaju — null 기둥 graceful', () => {
  it('hour null → hour_known=false, 슬롯 null, counts 합 5, 음양 6글자', () => {
    const derived = deriveSaju({
      year_pillar: '庚午',
      month_pillar: '己卯',
      day_pillar: '己卯',
      hour_pillar: null,
    });
    expect(derived.hour_known).toBe(false);
    expect(derived.sipsin.hour).toBeNull();
    expect(derived.jijanggan.hour).toBeNull();
    const sum = Object.values(derived.sipsin.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(5);
    expect(derived.yinyang_balance.yang + derived.yinyang_balance.yin).toBe(6);
  });

  it('month null(합성 입력) → 득령·운성 스킵, sipsin.month null', () => {
    const derived = deriveSaju({
      year_pillar: '庚午',
      month_pillar: null,
      day_pillar: '己卯',
      hour_pillar: null,
    });
    expect(derived.sipsin.month).toBeNull();
    expect(derived.jijanggan.month).toBeNull();
    expect(derived.sinkang.detail.month_unseong).toBeNull();
    expect(derived.sinkang.detail.deukryeong).toBe(0);
  });
});

describe('deriveSaju — §8.2 결정성 (determinism.test.ts 패턴 미러)', () => {
  const INPUT = {
    year_pillar: '庚午',
    month_pillar: '己卯',
    day_pillar: '己卯',
    hour_pillar: '辛未',
  };

  it('1000회 직렬화 동일 결과 (unique set size === 1)', () => {
    const runs = Array.from({ length: 1000 }, () => JSON.stringify(deriveSaju(INPUT)));
    expect(new Set(runs).size).toBe(1);
  });

  it('1000회 deep-equal 동일 결과', () => {
    const first = deriveSaju(INPUT);
    for (let i = 0; i < 1000; i += 1) {
      expect(deriveSaju(INPUT)).toEqual(first);
    }
  });
});
