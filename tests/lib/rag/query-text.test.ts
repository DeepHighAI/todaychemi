import { describe, it, expect, vi } from 'vitest';
import { buildRagQueryText } from '@/lib/rag/query-text';
import type { BuildHapcardInput } from '@/lib/hapcard/builder';
import type { ChartCore } from '@/types/chart';

const SELF: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const RELATION: ChartCore = {
  year_pillar: '기묘',
  month_pillar: '경진',
  day_pillar: '신사',
  hour_pillar: null,
  day_master_element: '금',
  five_elements_counts: { 목: 0, 화: 0, 토: 2, 금: 2, 수: 0 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const BASE_INPUT: BuildHapcardInput = {
  user_id: 'user-123',
  relation_id: 'rel-456',
  mode: '일합',
  self: SELF,
  self_chart_hash: 'self-hash-abc',
  relation: RELATION,
  relation_chart_hash: 'rel-hash-def',
  theory_profile_version: 'v1.0-late_zi',
  target_date: '2026-05-21',
};

describe('buildRagQueryText — 오늘 케미 RAG 쿼리 텍스트 빌더', () => {
  it('mode 한글 토큰을 포함한다', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text).toContain('일합');
  });

  it('self 일주(day_pillar)를 포함한다', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text).toContain('병인');
  });

  it('relation 일주(day_pillar)를 포함한다', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text).toContain('신사');
  });

  it('self 일간 오행을 포함한다', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text).toContain('화');
  });

  it('relation 일간 오행을 포함한다', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text).toContain('금');
  });

  it('동일 input → 동일 output (결정형)', () => {
    const a = buildRagQueryText(BASE_INPUT);
    const b = buildRagQueryText(BASE_INPUT);
    expect(a).toBe(b);
  });

  it('빈 문자열이 아닌 의미있는 길이의 텍스트 반환', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text.length).toBeGreaterThan(10);
  });

  it('PII 5필드 누출 없음 (user_id, relation_id 등 식별자 미포함)', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text).not.toContain('user-123');
    expect(text).not.toContain('rel-456');
    expect(text).not.toContain('self-hash-abc');
    expect(text).not.toContain('rel-hash-def');
  });

  it('mode 별로 다른 텍스트 (mode 토큰이 차이를 만든다)', () => {
    const ilhap = buildRagQueryText({ ...BASE_INPUT, mode: '일합' });
    const sseomhap = buildRagQueryText({ ...BASE_INPUT, mode: '썸합' });
    expect(ilhap).not.toBe(sseomhap);
  });
});

// P3-8 (ADR-040): derived 존재 시 dominant 십신 그룹 + 신강약 verdict 토큰 추가
describe('buildRagQueryText — 파생층 토큰 (ADR-040)', () => {
  it('derived 없는 v2 차트 → 기존 텍스트 그대로 (회귀 0)', () => {
    const text = buildRagQueryText(BASE_INPUT);
    expect(text).toBe('일합 일주 병인 일간 화 상대 일주 신사 상대 일간 금');
  });

  it('self.derived 존재 시 신강약 verdict + dominant 십신 그룹 토큰 포함', async () => {
    const { deriveSaju } = await import('@/lib/saju/derive');
    const derived = deriveSaju({
      year_pillar: SELF.year_pillar,
      month_pillar: SELF.month_pillar,
      day_pillar: SELF.day_pillar,
      hour_pillar: SELF.hour_pillar,
    });
    const text = buildRagQueryText({ ...BASE_INPUT, self: { ...SELF, derived } });
    expect(text).toContain(derived.sinkang.level);
    expect(text).toMatch(/십신 (비겁|식상|재성|관성|인성)/);
  });

  it('변형/구버전 derived → throw 없이 self-heal 재계산 토큰 (v2)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malformed = { derived_version: 1 } as unknown as NonNullable<ChartCore['derived']>;
    const text = buildRagQueryText({ ...BASE_INPUT, self: { ...SELF, derived: malformed } });
    // 저장 derived parse 실패 → 기둥 재계산 — 정상 derived 와 동일 토큰
    const { deriveSaju } = await import('@/lib/saju/derive');
    const healthy = buildRagQueryText({
      ...BASE_INPUT,
      self: {
        ...SELF,
        derived: deriveSaju({
          year_pillar: SELF.year_pillar,
          month_pillar: SELF.month_pillar,
          day_pillar: SELF.day_pillar,
          hour_pillar: SELF.hour_pillar,
        }),
      },
    });
    expect(text).toBe(healthy);
    expect(text).toMatch(/십신 |신강|신약|중화/);
    warnSpy.mockRestore();
  });

  it('derived 토큰 포함 시에도 결정형 (동일 input → 동일 output)', async () => {
    const { deriveSaju } = await import('@/lib/saju/derive');
    const derived = deriveSaju({
      year_pillar: SELF.year_pillar,
      month_pillar: SELF.month_pillar,
      day_pillar: SELF.day_pillar,
      hour_pillar: SELF.hour_pillar,
    });
    const input = { ...BASE_INPUT, self: { ...SELF, derived } };
    expect(buildRagQueryText(input)).toBe(buildRagQueryText(input));
  });
});
