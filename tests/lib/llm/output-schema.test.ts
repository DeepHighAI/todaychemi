import { describe, it, expect } from 'vitest';
import { HapcardLlmOutputSchema } from '@/lib/llm/output-schema';

const VALID = {
  main_text: '가'.repeat(180),
  cause_factors: [
    { name: '인연1', effect: '효과1' },
    { name: '인연2', effect: '효과2' },
    { name: '인연3', effect: '효과3' },
  ],
  classic_citation: [
    {
      asset_id: 'C001',
      source_title: '연해자평',
      source_chapter: '권3',
      original_text: '甲乙合化木',
      modern_translation: '갑을 합은 목으로 화한다',
      relevance_explanation: '두 사람의 일간 합 관계',
    },
  ],
  actions: ['행동1', '행동2', '행동3'],
  why_cards: [
    { title: '제목1', reason: '이유1' },
    { title: '제목2', reason: '이유2' },
  ],
};

describe('HapcardLlmOutputSchema — strict Zod', () => {
  describe('정상 케이스', () => {
    it('완전한 페이로드 통과', () => {
      const r = HapcardLlmOutputSchema.safeParse(VALID);
      expect(r.success).toBe(true);
    });

    it('original_reading 선택 필드 포함 통과', () => {
      const payload = {
        ...VALID,
        classic_citation: [
          { ...VALID.classic_citation[0], original_reading: '갑을합화목' },
        ],
      };
      const r = HapcardLlmOutputSchema.safeParse(payload);
      expect(r.success).toBe(true);
    });

    it('reference_url 선택 필드 포함 통과', () => {
      const payload = {
        ...VALID,
        classic_citation: [
          { ...VALID.classic_citation[0], reference_url: 'https://example.com' },
        ],
      };
      const r = HapcardLlmOutputSchema.safeParse(payload);
      expect(r.success).toBe(true);
    });
  });

  describe('main_text 길이 (120-240자)', () => {
    it('119자 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, main_text: '가'.repeat(119) });
      expect(r.success).toBe(false);
    });

    it('120자 통과 (하한)', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, main_text: '가'.repeat(120) });
      expect(r.success).toBe(true);
    });

    it('201자 통과 (구 상한 200 초과 → 신규 허용)', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, main_text: '가'.repeat(201) });
      expect(r.success).toBe(true);
    });

    it('240자 통과 (상한)', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, main_text: '가'.repeat(240) });
      expect(r.success).toBe(true);
    });

    it('241자 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, main_text: '가'.repeat(241) });
      expect(r.success).toBe(false);
    });
  });

  describe('cause_factors 정확히 3개', () => {
    it('2개 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({
        ...VALID,
        cause_factors: VALID.cause_factors.slice(0, 2),
      });
      expect(r.success).toBe(false);
    });

    it('4개 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({
        ...VALID,
        cause_factors: [...VALID.cause_factors, { name: '4', effect: '4' }],
      });
      expect(r.success).toBe(false);
    });

    it('각 항목 name+effect 필수', () => {
      const r = HapcardLlmOutputSchema.safeParse({
        ...VALID,
        cause_factors: [
          { name: '1', effect: '1' },
          { name: '2' },
          { name: '3', effect: '3' },
        ],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('actions 정확히 3개', () => {
    it('2개 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, actions: ['a', 'b'] });
      expect(r.success).toBe(false);
    });

    it('4개 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, actions: ['a', 'b', 'c', 'd'] });
      expect(r.success).toBe(false);
    });
  });

  describe('classic_citation 필수 필드', () => {
    it('asset_id 누락 거부', () => {
      const broken = { ...VALID.classic_citation[0] } as Record<string, unknown>;
      delete broken.asset_id;
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, classic_citation: [broken] });
      expect(r.success).toBe(false);
    });

    it('source_title 누락 거부', () => {
      const broken = { ...VALID.classic_citation[0] } as Record<string, unknown>;
      delete broken.source_title;
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, classic_citation: [broken] });
      expect(r.success).toBe(false);
    });

    it('original_text 누락 거부', () => {
      const broken = { ...VALID.classic_citation[0] } as Record<string, unknown>;
      delete broken.original_text;
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, classic_citation: [broken] });
      expect(r.success).toBe(false);
    });

    it('relevance_explanation 누락 거부', () => {
      const broken = { ...VALID.classic_citation[0] } as Record<string, unknown>;
      delete broken.relevance_explanation;
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, classic_citation: [broken] });
      expect(r.success).toBe(false);
    });

    it('빈 배열 통과 (RAG 0건 대응)', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, classic_citation: [] });
      expect(r.success).toBe(true);
    });
  });

  describe('why_cards', () => {
    it('빈 배열 거부 (Q5 잠금: 최소 1개)', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, why_cards: [] });
      expect(r.success).toBe(false);
    });

    it('각 항목 title+reason 필수', () => {
      const r = HapcardLlmOutputSchema.safeParse({
        ...VALID,
        why_cards: [{ title: '제목' }],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('strict mode (추가 키 거부)', () => {
    it('루트에 unknown 키 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({ ...VALID, score: 85 });
      expect(r.success).toBe(false);
    });

    it('cause_factors 항목에 unknown 키 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({
        ...VALID,
        cause_factors: [
          { name: '1', effect: '1', extra: 'x' },
          { name: '2', effect: '2' },
          { name: '3', effect: '3' },
        ],
      });
      expect(r.success).toBe(false);
    });

    it('classic_citation 항목에 unknown 키 거부', () => {
      const r = HapcardLlmOutputSchema.safeParse({
        ...VALID,
        classic_citation: [{ ...VALID.classic_citation[0], hidden: 'x' }],
      });
      expect(r.success).toBe(false);
    });
  });
});
