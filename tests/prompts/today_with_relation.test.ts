import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// G2 / Phase 3 C6 — today_with_relation 프롬프트 정적 회귀 가드.
// daily_hap.md 와 동일 ADR 헤더 + 3축 입력 명세 + 다양한 예시 보장.
const PROMPT_PATH = join(process.cwd(), 'prompts', 'system', 'today_with_relation.md');
let prompt = '';
beforeAll(() => {
  prompt = readFileSync(PROMPT_PATH, 'utf-8');
});

describe('today_with_relation.md — 정적 회귀 가드', () => {
  describe('헤더 / 메타', () => {
    it('Mode 식별자: today_with_relation', () => {
      expect(prompt).toMatch(/Mode:\s*오늘합 \(today_with_relation\)/);
    });

    it('Version 헤더 존재', () => {
      expect(prompt).toMatch(/Version:\s*v0\./);
    });

    it('banned_phrases catalog 참조', () => {
      expect(prompt).toMatch(/banned_phrases_catalog\.yaml/);
    });

    it('Model: GPT-5 명시 (C5 격상 반영)', () => {
      expect(prompt).toMatch(/Model:\s*GPT-5(?![- ]mini)/);
    });
  });

  describe('ADR 헤더 / 제약', () => {
    it('ADR-009 운세 단정 표현 금지', () => {
      expect(prompt).toMatch(/ADR-009/);
    });
    it('ADR-015 명리 근거 항상 표시', () => {
      expect(prompt).toMatch(/ADR-015/);
    });
    it('ADR-034 글자수 상한', () => {
      expect(prompt).toMatch(/ADR-034/);
    });
    it('ADR-035 점수·확률·숫자 예측 금지', () => {
      expect(prompt).toMatch(/ADR-035/);
    });
    it('ADR-038 한자 노출 금지', () => {
      expect(prompt).toMatch(/ADR-038/);
    });
  });

  describe('PII 0건 헤더', () => {
    it('PII 5필드 명시 (birth_date, name, nickname, email, birth_place)', () => {
      expect(prompt).toMatch(/birth_date/);
      expect(prompt).toMatch(/nickname/);
      expect(prompt).toMatch(/email/);
      expect(prompt).toMatch(/birth_place/);
    });
    it('pii_minimization 문서 참조', () => {
      expect(prompt).toMatch(/pii_minimization/);
    });
  });

  describe('3축 입력 명세', () => {
    it('chart_core 명시', () => {
      expect(prompt).toMatch(/chart_core/);
    });
    it('relation_chart_core 명시 (인연 종합)', () => {
      expect(prompt).toMatch(/relation_chart_core/);
    });
    it('today_date 명시', () => {
      expect(prompt).toMatch(/today_date/);
    });
  });

  describe('출력 스키마 6필드', () => {
    it('headline / headline_reason / avoid_phrase / avoid_phrase_reason / favorable_action / favorable_action_reason', () => {
      expect(prompt).toMatch(/headline/);
      expect(prompt).toMatch(/headline_reason/);
      expect(prompt).toMatch(/avoid_phrase/);
      expect(prompt).toMatch(/avoid_phrase_reason/);
      expect(prompt).toMatch(/favorable_action/);
      expect(prompt).toMatch(/favorable_action_reason/);
    });
  });

  describe('해석 우선 순위 가이드', () => {
    it('오늘 일진 vs 일간 관계 가이드 존재', () => {
      expect(prompt).toMatch(/일진.*일간|일간.*일진/);
    });
    it('오행 보완 vs 충돌 가이드 존재', () => {
      expect(prompt).toMatch(/오행/);
    });
    it('인물 지정·이름 호칭 금지 가이드 존재', () => {
      expect(prompt).toMatch(/인물.*지정|이름.*지정|OO.*만나/);
    });
  });

  describe('예시 케이스 다양성 (3가지 흐름)', () => {
    it('최소 3개의 출력 예시(JSON Output) 포함 — 다양한 시나리오(보완/균형/긴장 등)', () => {
      const outputBlocks = prompt.match(/\*\*Output\*\*/g) ?? [];
      expect(outputBlocks.length).toBeGreaterThanOrEqual(3);
    });

    it('최소 3개의 입력 예시(JSON Input) 포함', () => {
      const inputBlocks = prompt.match(/\*\*Input\*\*/g) ?? [];
      expect(inputBlocks.length).toBeGreaterThanOrEqual(3);
    });
  });
});
