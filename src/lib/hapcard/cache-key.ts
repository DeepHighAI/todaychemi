import { createHash } from 'node:crypto';
import type { Mode } from '@/types/mode';

export interface CacheKeyInput {
  user_chart_hash: string;
  relation_chart_hash: string;
  mode: Mode;
  prompt_version: string;
  theory_profile_version: string;
  target_date: string;
}

// llm_governance.md §1.3 — sha256(user + relation + mode + prompt + theory + target date)
// 필드 순서 고정: 객체 키 순서와 무관하게 결정형이어야 함
export function deriveCacheKey(input: CacheKeyInput): string {
  const payload =
    input.user_chart_hash +
    input.relation_chart_hash +
    input.mode +
    input.prompt_version +
    input.theory_profile_version +
    input.target_date;
  return createHash('sha256').update(payload).digest('hex');
}
