import { describe, it, expect } from 'vitest';

import { computeSinkang, sinkangLevelOf } from '@/lib/saju/sinkang';

describe('computeSinkang — golden hand-computed cases', () => {
  it('scores 득령+건록 as 신강 with full detail breakdown', () => {
    // 일간 甲(목). 표면: 천간 甲丙甲乙 / 지지 寅寅子亥
    // 목=5(甲甲乙寅寅) → own 50; 수=2(子亥) → support 16; 금=0 → pressure 0
    // 득령: 월지 寅(목)==목 → +20; 월운성: stage12(甲,寅)=건록 → +15
    const result = computeSinkang({
      year: '甲寅',
      month: '丙寅',
      day: '甲子',
      hour: '乙亥',
    });
    expect(result.detail).toEqual({
      base: 50,
      deukryeong: 20,
      own_term: 50,
      support_term: 16,
      pressure_term: 0,
      unseong_term: 15,
      month_unseong: '건록',
    });
    expect(result.score).toBe(151);
    expect(result.level).toBe('신강');
  });

  it('handles null hour with 6-char surface count (중화)', () => {
    // 일간 甲(목). 표면 6글자: 庚庚甲 / 申辰子
    // 목=1 → own 10; 수=1(子) → support 8; 금=3(庚庚申) → pressure -24
    // 월지 辰(토)≠목 → 득령 0; stage12(甲,辰)=쇠 → 0
    const result = computeSinkang({
      year: '庚申',
      month: '庚辰',
      day: '甲子',
      hour: null,
    });
    expect(result.detail).toEqual({
      base: 50,
      deukryeong: 0,
      own_term: 10,
      support_term: 8,
      pressure_term: -24,
      unseong_term: 0,
      month_unseong: '쇠',
    });
    expect(result.score).toBe(44);
    expect(result.level).toBe('중화');
  });

  it('applies -15 for 사/절/묘 month unseong (신약)', () => {
    // 일간 甲(목). 표면: 庚壬甲辛 / 申午申酉
    // 목=1 → own 10; 수=1(壬) → support 8; 금=5(庚辛申申酉) → pressure -40
    // 월지 午(화)≠목 → 득령 0; stage12(甲,午)=사 → -15
    const result = computeSinkang({
      year: '庚申',
      month: '壬午',
      day: '甲申',
      hour: '辛酉',
    });
    expect(result.detail).toEqual({
      base: 50,
      deukryeong: 0,
      own_term: 10,
      support_term: 8,
      pressure_term: -40,
      unseong_term: -15,
      month_unseong: '사',
    });
    expect(result.score).toBe(13);
    expect(result.level).toBe('신약');
  });

  it('skips 득령 and 운성 when month pillar is null', () => {
    // 일간 甲(목). 표면 4글자: 甲甲 / 寅子 → 목=3 own 30, 수=1 support 8
    const result = computeSinkang({
      year: '甲寅',
      month: null,
      day: '甲子',
      hour: null,
    });
    expect(result.detail.deukryeong).toBe(0);
    expect(result.detail.unseong_term).toBe(0);
    expect(result.detail.month_unseong).toBeNull();
    expect(result.score).toBe(88);
    expect(result.level).toBe('신강');
  });

  it('detail terms always sum to score (additive invariant)', () => {
    const cases = [
      { year: '甲寅', month: '丙寅', day: '甲子', hour: '乙亥' },
      { year: '庚申', month: '庚辰', day: '甲子', hour: null },
      { year: '庚申', month: '壬午', day: '甲申', hour: '辛酉' },
      { year: '癸卯', month: '乙卯', day: '丁巳', hour: '庚戌' },
      { year: '丙午', month: '甲午', day: '壬子', hour: null },
    ];
    for (const pillars of cases) {
      const { score, detail } = computeSinkang(pillars);
      expect(
        detail.base +
          detail.deukryeong +
          detail.own_term +
          detail.support_term +
          detail.pressure_term +
          detail.unseong_term,
      ).toBe(score);
    }
  });

  it('is deterministic for identical input', () => {
    const input = { year: '甲寅', month: '丙寅', day: '甲子', hour: '乙亥' };
    const first = computeSinkang(input);
    for (let i = 0; i < 100; i += 1) {
      expect(computeSinkang(input)).toEqual(first);
    }
  });
});

// 리뷰: 임계 경계(70/30) 회귀 잠금 — >= / <= 의미 (off-by-one 방어)
describe('sinkangLevelOf — 경계값', () => {
  it('score 70 = 신강 (>=), 69 = 중화', () => {
    expect(sinkangLevelOf(70)).toBe('신강');
    expect(sinkangLevelOf(69)).toBe('중화');
  });

  it('score 30 = 신약 (<=), 31 = 중화', () => {
    expect(sinkangLevelOf(30)).toBe('신약');
    expect(sinkangLevelOf(31)).toBe('중화');
  });

  it('computeSinkang level 은 sinkangLevelOf(score)와 항상 일치', () => {
    const result = computeSinkang({ year: '甲寅', month: '丙寅', day: '甲子', hour: '乙亥' });
    expect(result.level).toBe(sinkangLevelOf(result.score));
  });
});
