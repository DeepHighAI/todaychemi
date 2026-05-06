import { createHash } from 'node:crypto';
import type { LlmPayload } from '@/lib/llm/payload';

const JINJIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReplayCacheKeyInput {
  user_chart_hash: string;
  relation_chart_hash: string;
  prompt_version: string;
  theory_profile_version: string;
  jinjin_date: string; // YYYY-MM-DD (UTC+9)
}

// spec §8: replay_cache_key = sha256(chart_hash | scoring_version | prompt_version | jinjin_date)
export function buildReplayCacheKey(input: ReplayCacheKeyInput): string {
  const payload =
    input.user_chart_hash +
    input.relation_chart_hash +
    input.prompt_version +
    input.theory_profile_version +
    input.jinjin_date;
  return createHash('sha256').update(payload).digest('hex');
}

// spec §10: 6모드 system prompt 첫 줄에 [재해석 모드 — 일진:YYYY-MM-DD] prepend
export function buildReplaySystemPrompt(systemPrompt: string, jinjin_date: string): string {
  if (!JINJIN_DATE_RE.test(jinjin_date)) {
    throw new Error(`INVALID_JINJIN_DATE: ${jinjin_date}`);
  }
  return `[재해석 모드 — 일진:${jinjin_date}]\n${systemPrompt}`;
}

// time_context 추가 (불변 — 원본 payload 변이 없음)
export function buildReplayPayload(
  payload: LlmPayload,
  jinjin_date: string,
): LlmPayload {
  return { ...payload, time_context: { jinjin_date } };
}
