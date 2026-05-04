import { describe, it, expect } from 'vitest';
import { loadBannedPhrases, findBannedPhrase, findScoreLeak } from '@/lib/llm/banned-phrases';

describe('loadBannedPhrases — YAML 카탈로그 로드', () => {
  it('5개 카테고리 로드', () => {
    const catalog = loadBannedPhrases();
    const categories = catalog.map((c) => c.category);
    expect(categories).toContain('fortune_assertion');
    expect(categories).toContain('date_prediction');
    expect(categories).toContain('health_medical');
    expect(categories).toContain('legal_financial');
    expect(categories).toContain('relationship_definitive');
  });

  it('각 카테고리에 phrases 배열 존재', () => {
    const catalog = loadBannedPhrases();
    for (const cat of catalog) {
      expect(Array.isArray(cat.phrases)).toBe(true);
      expect(cat.phrases.length).toBeGreaterThan(0);
    }
  });

  it('커스텀 YAML 문자열로 로드', () => {
    const yaml = `
categories:
  test_cat:
    description: 테스트
    phrases:
      - 금지어A
      - 금지어B
`;
    const catalog = loadBannedPhrases(yaml);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].category).toBe('test_cat');
    expect(catalog[0].phrases).toEqual(['금지어A', '금지어B']);
  });
});

describe('findBannedPhrase — 텍스트 매칭', () => {
  it('fortune_assertion — "반드시 결혼한다" 매치', () => {
    const catalog = loadBannedPhrases();
    const hit = findBannedPhrase('반드시 결혼한다', catalog);
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('fortune_assertion');
      expect(hit.phrase).toBe('반드시');
    }
  });

  it('date_prediction — "월에 결혼" 매치', () => {
    const catalog = loadBannedPhrases();
    const hit = findBannedPhrase('올해 3월에 결혼할 것입니다', catalog);
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('date_prediction');
    }
  });

  it('health_medical — "수술하" 매치', () => {
    const catalog = loadBannedPhrases();
    const hit = findBannedPhrase('내년에 수술하게 됩니다', catalog);
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('health_medical');
    }
  });

  it('legal_financial — "파산" 매치', () => {
    const catalog = loadBannedPhrases();
    const hit = findBannedPhrase('사업 파산 위험이 있습니다', catalog);
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('legal_financial');
    }
  });

  it('relationship_definitive — "헤어진다" 매치', () => {
    const catalog = loadBannedPhrases();
    const hit = findBannedPhrase('두 분은 결국 헤어진다', catalog);
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('relationship_definitive');
    }
  });

  it('클린 텍스트 — found:false', () => {
    const catalog = loadBannedPhrases();
    const hit = findBannedPhrase('건강하게 지내는 흐름이 강합니다', catalog);
    expect(hit.found).toBe(false);
  });

  it('빈 문자열 — found:false', () => {
    const catalog = loadBannedPhrases();
    const hit = findBannedPhrase('', catalog);
    expect(hit.found).toBe(false);
  });
});

describe('findScoreLeak — ADR-035 점수 누설 탐지', () => {
  it('"85점입니다" — score_leak (regex 1: 숫자+점)', () => {
    const hit = findScoreLeak('두 분의 합점은 85점입니다');
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('score_leak');
    }
  });

  it('"score: 85" — score_leak (regex 2, 대소문자 무관)', () => {
    const hit = findScoreLeak('compatibility score: 85');
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('score_leak');
    }
  });

  it('"SCORE: 85" — 대문자도 매치', () => {
    const hit = findScoreLeak('SCORE: 85');
    expect(hit.found).toBe(true);
  });

  it('"합점수 85" — score_leak (regex 3)', () => {
    const hit = findScoreLeak('합점수 85로 나타났습니다');
    expect(hit.found).toBe(true);
    if (hit.found) {
      expect(hit.category).toBe('score_leak');
    }
  });

  it('숫자 없는 텍스트 — found:false', () => {
    const hit = findScoreLeak('두 분은 서로를 보완하는 기운이 있습니다');
    expect(hit.found).toBe(false);
  });

  it('빈 문자열 — found:false', () => {
    const hit = findScoreLeak('');
    expect(hit.found).toBe(false);
  });
});
