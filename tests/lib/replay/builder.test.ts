import { describe, it, expect } from 'vitest';
import {
  buildReplaySystemPrompt,
  buildReplayPayload,
  buildReplayCacheKey,
} from '@/lib/replay/builder';
import type { LlmPayload } from '@/lib/llm/payload';

const BASE_PROMPT = '# System Prompt — 일합 (일·직장 궁합)\n본문 내용';
const JINJIN_DATE = '2026-05-06';

const BASE_PAYLOAD: LlmPayload = {
  self_chart_core: {
    year_pillar: '갑자',
    month_pillar: '을축',
    day_pillar: '병인',
    hour_pillar: null,
    day_master_element: '화',
    five_elements_counts: { 목: 2, 화: 1, 토: 1, 금: 0, 수: 0 },
    gender_normalized: 'M',
  },
  relation_chart_core: {
    year_pillar: '기묘',
    month_pillar: '경진',
    day_pillar: '신사',
    hour_pillar: null,
    day_master_element: '금',
    five_elements_counts: { 목: 0, 화: 0, 토: 2, 금: 2, 수: 0 },
    gender_normalized: 'F',
  },
  mode: '일합',
  theory_profile: { profile_version: 'v1.0' },
};

describe('buildReplaySystemPrompt', () => {
  it('첫 줄에 재해석 모드 태그를 prepend한다', () => {
    const result = buildReplaySystemPrompt(BASE_PROMPT, JINJIN_DATE);
    const firstLine = result.split('\n')[0];
    expect(firstLine).toBe('[재해석 모드 — 일진:2026-05-06]');
  });

  it('원본 systemPrompt 내용을 보존한다', () => {
    const result = buildReplaySystemPrompt(BASE_PROMPT, JINJIN_DATE);
    expect(result).toContain(BASE_PROMPT);
  });

  it('잘못된 jinjin_date 형식 시 에러를 던진다', () => {
    expect(() => buildReplaySystemPrompt(BASE_PROMPT, '05-06-2026')).toThrow('INVALID_JINJIN_DATE');
    expect(() => buildReplaySystemPrompt(BASE_PROMPT, '2026/05/06')).toThrow('INVALID_JINJIN_DATE');
    expect(() => buildReplaySystemPrompt(BASE_PROMPT, '')).toThrow('INVALID_JINJIN_DATE');
  });
});

describe('buildReplayPayload', () => {
  it('time_context 필드가 추가된 페이로드를 반환한다', () => {
    const result = buildReplayPayload(BASE_PAYLOAD, JINJIN_DATE);
    expect(result.time_context).toEqual({ jinjin_date: JINJIN_DATE });
  });

  it('원본 페이로드 필드를 모두 보존한다', () => {
    const result = buildReplayPayload(BASE_PAYLOAD, JINJIN_DATE);
    expect(result.self_chart_core).toEqual(BASE_PAYLOAD.self_chart_core);
    expect(result.relation_chart_core).toEqual(BASE_PAYLOAD.relation_chart_core);
    expect(result.mode).toBe('일합');
    expect(result.theory_profile).toEqual(BASE_PAYLOAD.theory_profile);
  });

  it('원본 페이로드 객체를 변이하지 않는다', () => {
    buildReplayPayload(BASE_PAYLOAD, JINJIN_DATE);
    expect((BASE_PAYLOAD as unknown as Record<string, unknown>).time_context).toBeUndefined();
  });
});

describe('buildReplayCacheKey', () => {
  it('동일 입력은 항상 같은 해시를 반환한다 (결정형)', () => {
    const a = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: JINJIN_DATE,
    });
    const b = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: JINJIN_DATE,
    });
    expect(a).toBe(b);
  });

  it('jinjin_date 가 다르면 해시가 달라진다', () => {
    const a = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: '2026-05-06',
    });
    const b = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: '2026-05-07',
    });
    expect(a).not.toBe(b);
  });

  it('64자 hex 문자열을 반환한다 (sha256)', () => {
    const key = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: JINJIN_DATE,
    });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
