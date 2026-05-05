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
});
