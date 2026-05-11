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
  it('"滴天髓(적천수)" — Hanja outside, Korean inside parens → unchanged', () => {
    expect(stripHanjaInParens('滴天髓(적천수)')).toBe('滴天髓(적천수)');
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
    // 官·多·者·身·弱·食·傷·可·用 — none are in any single-char or compound map
    expect(transliterateHanja('官多者身弱, 食傷可用')).toBe('官多者身弱, 食傷可用');
  });
  it('pure Korean → unchanged', () => {
    expect(transliterateHanja('재성을 생하여')).toBe('재성을 생하여');
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
  it('idempotent: convertHanja(convertHanja("木火土")) === convertHanja("木火土")', () => {
    expect(convertHanja('木火土')).toBe(convertHanja(convertHanja('木火土')));
  });
  it('empty string → ""', () => {
    expect(convertHanja('')).toBe('');
  });
  it('pure Korean "관성이 많아" → "관성이 많아"', () => {
    expect(convertHanja('관성이 많아')).toBe('관성이 많아');
  });
});

describe('translateChapter', () => {
  it('"通神頌" → "통신송"', () => {
    expect(translateChapter('通神頌')).toBe('통신송');
  });
  it('"體用" → "체용"', () => {
    expect(translateChapter('體用')).toBe('체용');
  });
  it('unknown chapter "佚文" → falls back to transliterateHanja, returns "佚文" unchanged', () => {
    const result = translateChapter('佚文');
    expect(result).toBe('佚文');
  });
});
