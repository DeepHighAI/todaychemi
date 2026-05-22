import { describe, it, expect } from 'vitest';
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

describe('buildRagQueryText — 오늘 우리는 RAG 쿼리 텍스트 빌더', () => {
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
