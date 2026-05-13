import { describe, it, expect } from 'vitest';
import { GLOSSARY_TERMS, type GlossaryTerm } from '@/lib/glossary/terms';

const REQUIRED_TERMS = ['일주', '십신', '합', '형', '충', '해'] as const;

describe('GLOSSARY_TERMS', () => {
  it('6개 필수 용어를 모두 포함한다', () => {
    for (const term of REQUIRED_TERMS) {
      expect(GLOSSARY_TERMS).toHaveProperty(term);
    }
  });

  it('각 항목이 GlossaryTerm 형태를 충족한다', () => {
    for (const term of REQUIRED_TERMS) {
      const entry: GlossaryTerm = GLOSSARY_TERMS[term];
      expect(typeof entry.term).toBe('string');
      expect(entry.term.length).toBeGreaterThan(0);
      expect(typeof entry.definition).toBe('string');
      // 2-3문장, ≤200자
      expect(entry.definition.length).toBeGreaterThan(0);
      expect(entry.definition.length).toBeLessThanOrEqual(200);
      // classic_quote: { source, original } | null
      if (entry.classic_quote !== null) {
        expect(typeof entry.classic_quote.source).toBe('string');
        expect(entry.classic_quote.source.length).toBeGreaterThan(0);
        expect(typeof entry.classic_quote.original).toBe('string');
        expect(entry.classic_quote.original.length).toBeGreaterThan(0);
      }
    }
  });

  it('일주·형·해는 고전 인용 없음 (null)', () => {
    expect(GLOSSARY_TERMS['일주'].classic_quote).toBeNull();
    expect(GLOSSARY_TERMS['형'].classic_quote).toBeNull();
    expect(GLOSSARY_TERMS['해'].classic_quote).toBeNull();
  });

  it('십신·합·충은 고전 인용이 있다', () => {
    expect(GLOSSARY_TERMS['십신'].classic_quote).not.toBeNull();
    expect(GLOSSARY_TERMS['합'].classic_quote).not.toBeNull();
    expect(GLOSSARY_TERMS['충'].classic_quote).not.toBeNull();
  });

  it('각 용어가 extended_definition(short definition보다 긴 본문)을 가진다', () => {
    for (const term of REQUIRED_TERMS) {
      const entry = GLOSSARY_TERMS[term];
      expect(typeof entry.extended_definition).toBe('string');
      expect(entry.extended_definition!.length).toBeGreaterThan(entry.definition.length);
    }
  });

  it('각 용어가 related_terms(다른 용어 키 ≥ 1개)을 가진다', () => {
    for (const term of REQUIRED_TERMS) {
      const entry = GLOSSARY_TERMS[term];
      expect(Array.isArray(entry.related_terms)).toBe(true);
      expect(entry.related_terms!.length).toBeGreaterThanOrEqual(1);
      for (const related of entry.related_terms!) {
        expect(REQUIRED_TERMS).toContain(related);
      }
    }
  });

  it('related_terms에 자기 자신은 포함되지 않는다', () => {
    for (const term of REQUIRED_TERMS) {
      const entry = GLOSSARY_TERMS[term];
      expect(entry.related_terms!).not.toContain(term);
    }
  });

  it('합/형/충/해에 display_label(소프트 용어)이 있다', () => {
    expect(GLOSSARY_TERMS['합'].display_label).toBe('끌림');
    expect(GLOSSARY_TERMS['형'].display_label).toBe('긴장');
    expect(GLOSSARY_TERMS['충'].display_label).toBe('부딪힘');
    expect(GLOSSARY_TERMS['해'].display_label).toBe('소모');
  });

  it('일주·십신은 display_label이 없다', () => {
    expect(GLOSSARY_TERMS['일주'].display_label).toBeUndefined();
    expect(GLOSSARY_TERMS['십신'].display_label).toBeUndefined();
  });
});

describe('GLOSSARY_TERMS — compound terms', () => {
  const COMPOUND_TERMS = [
    '자오충', '축미충', '인신충', '묘유충', '진술충', '사해충',
    '인오술', '신자진', '사유축', '해묘미',
    '삼합', '반합',
  ] as const;

  it('12개 compound 용어가 모두 등록되어 있다', () => {
    for (const term of COMPOUND_TERMS) {
      expect(GLOSSARY_TERMS).toHaveProperty(term);
    }
  });

  it('각 compound 항목이 GlossaryTerm 기본 구조를 충족한다 (term, definition, classic_quote)', () => {
    for (const key of COMPOUND_TERMS) {
      const entry = GLOSSARY_TERMS[key];
      expect(typeof entry.term).toBe('string');
      expect(entry.term.length).toBeGreaterThan(0);
      expect(typeof entry.definition).toBe('string');
      expect(entry.definition.length).toBeGreaterThan(0);
      expect(entry.definition.length).toBeLessThanOrEqual(200);
      expect(entry.classic_quote).toBeNull();
    }
  });

  it('compound 용어들은 display_label이 없다 (soft alias 없음)', () => {
    for (const key of COMPOUND_TERMS) {
      expect(GLOSSARY_TERMS[key].display_label).toBeUndefined();
    }
  });
});
