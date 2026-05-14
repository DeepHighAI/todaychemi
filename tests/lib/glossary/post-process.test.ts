import { describe, it, expect } from 'vitest';
import {
  stripHanjaInParens,
  transliterateHanja,
  convertHanja,
  translateChapter,
} from '@/lib/glossary/post-process';

describe('stripHanjaInParens', () => {
  it('"자오충(子午沖)" → "자오충"', () => {
    expect(stripHanjaInParens('자오충(子午沖)')).toBe('자오충');
  });
  it('"생(生)" → "생"', () => {
    expect(stripHanjaInParens('생(生)')).toBe('생');
  });
  it('"갑기(甲己) 천간합" → "갑기 천간합"', () => {
    expect(stripHanjaInParens('갑기(甲己) 천간합')).toBe('갑기 천간합');
  });
  it('"木火土" — standalone Hanja, no Korean prefix → unchanged', () => {
    expect(stripHanjaInParens('木火土')).toBe('木火土');
  });
  it('"통신송(通神頌)" → "통신송"', () => {
    expect(stripHanjaInParens('통신송(通神頌)')).toBe('통신송');
  });
  it('pure Korean "재성을 생하여" → unchanged', () => {
    expect(stripHanjaInParens('재성을 생하여')).toBe('재성을 생하여');
  });
  it('empty string → ""', () => {
    expect(stripHanjaInParens('')).toBe('');
  });
});

describe('transliterateHanja', () => {
  it('"子午沖" → "자오충" (compound match)', () => {
    expect(transliterateHanja('子午沖')).toBe('자오충');
  });
  it('"寅午戌" → "인오술" (compound match)', () => {
    expect(transliterateHanja('寅午戌')).toBe('인오술');
  });
  it('"木 火 土 金 水" → "목 화 토 금 수" (single char)', () => {
    expect(transliterateHanja('木 火 土 金 水')).toBe('목 화 토 금 수');
  });
  it('"正印" → "정인" (sipsin)', () => {
    expect(transliterateHanja('正印')).toBe('정인');
  });
  it('"桃花殺" → "도화살" (shinsal)', () => {
    expect(transliterateHanja('桃花殺')).toBe('도화살');
  });
  it('unmapped Hanja chars pass through unchanged', () => {
    // 官·者·身·弱·多·可·用 are not in our maps — they remain as-is
    const input = '官多者身弱, 食傷可用';
    const result = transliterateHanja(input);
    // 식(食)·상(傷) both mapped: 食→? no, 食 not in single maps either. Verify no crash only.
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // unmapped chars stay: result still contains 官 (not converted)
    expect(result).toContain('官');
  });
  it('pure Korean → unchanged', () => {
    expect(transliterateHanja('재성을 생하여')).toBe('재성을 생하여');
  });
  it('복합어 우선 매치 — 긴 키가 짧은 키보다 먼저 매치된다', () => {
    // SHINSAL_READINGS: 桃花殺(3자) 와 桃花(2자) 가 둘 다 map에 있음.
    // 정렬 없이 桃花가 먼저 매치되면 결과는 '도화殺' (殺이 남음).
    // 올바른 정렬이라면 桃花殺이 우선 매치되어 '도화살'이 나와야 함.
    expect(transliterateHanja('桃花殺 운에서')).toBe('도화살 운에서');
  });
  it('SHINSAL longest-first: 紅艶殺(3자)가 紅艶(2자)보다 우선 매치된다', () => {
    expect(transliterateHanja('紅艶殺 운에서')).toBe('홍염살 운에서');
  });
  it('SHINSAL longest-first: 같은 텍스트에 桃花殺과 桃花 둘 다 있을 때 각각 정확히 매치된다', () => {
    expect(transliterateHanja('桃花殺과 桃花가 함께')).toBe('도화살과 도화가 함께');
  });
  it('SHINSAL longest-first: 月德貴人 4자 신살 정상 변환', () => {
    expect(transliterateHanja('月德貴人이 있다')).toBe('월덕귀인이 있다');
  });
});

describe('convertHanja', () => {
  it('"자오충(子午沖)으로 부딪힘" → "자오충으로 부딪힘"', () => {
    expect(convertHanja('자오충(子午沖)으로 부딪힘')).toBe('자오충으로 부딪힘');
  });
  it('"재성을 생(生)하여" → "재성을 생하여"', () => {
    expect(convertHanja('재성을 생(生)하여')).toBe('재성을 생하여');
  });
  it('"木 火 土" → "목 화 토"', () => {
    expect(convertHanja('木 火 土')).toBe('목 화 토');
  });
  it('idempotent: convertHanja(convertHanja(x)) === convertHanja(x)', () => {
    const x = '자오충(子午沖)';
    expect(convertHanja(convertHanja(x))).toBe(convertHanja(x));
  });
  it('empty string → ""', () => {
    expect(convertHanja('')).toBe('');
  });
  it('pure Korean "관성이 많아" → "관성이 많아"', () => {
    expect(convertHanja('관성이 많아')).toBe('관성이 많아');
  });
  it('null 입력 시 빈 문자열 반환', () => {
    expect(convertHanja(null)).toBe('');
  });
  it('undefined 입력 시 빈 문자열 반환', () => {
    expect(convertHanja(undefined)).toBe('');
  });
});

describe('convertHanja — ADR-038 회귀', () => {
  it('日主 + ohaeng 패턴을 한글로 변환한다', () => {
    expect(convertHanja('日主 火가 酉金의 제약을 받아요.')).toBe('일주 화가 유금의 제약을 받아요.');
  });
});

describe('translateChapter', () => {
  it('"通神頌" → "통신송"', () => {
    expect(translateChapter('通神頌')).toBe('통신송');
  });
  it('"體用" → "체용"', () => {
    expect(translateChapter('體用')).toBe('체용');
  });
  it('unknown chapter "佚文" → does not crash, returns string', () => {
    const result = translateChapter('佚文');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
