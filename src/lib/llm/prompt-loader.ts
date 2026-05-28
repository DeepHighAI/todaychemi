import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mode } from '@/types/mode';
import type { PromptVersion } from '@/types/prompt';

// 한글 모드 → 영문 prompt_name (prompts/system/*.md 파일명과 동일)
export const MODE_TO_PROMPT_NAME: Record<Mode, string> = {
  '일합': 'ilhap',
  '친구합': 'chinguhap',
  '돈합': 'donhap',
  '첫합': 'cheothap',
  '썸합': 'sseomhap',
  '오래합': 'oraehap',
};

/**
 * @deprecated Task 2 / ADR-008 — loadPromptForUser 로 이행 중. status='active' 단일 행만 반환.
 * canary 분기를 인식하지 않으므로 신규 호출은 loadPromptForUser 사용.
 */
export async function loadActivePrompt(
  client: SupabaseClient,
  mode: Mode,
): Promise<PromptVersion> {
  const promptName = MODE_TO_PROMPT_NAME[mode];

  const { data, error } = await client
    .from('prompt_versions')
    .select('*')
    .eq('prompt_name', promptName)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(`prompt_versions query failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`PROMPT_NOT_FOUND: ${promptName}`);
  }
  return data as PromptVersion;
}

/**
 * ADR-008 canary 5% 분산 라우팅 — deterministic per-user sampling.
 *
 * 동작:
 *   1. status IN ('active','canary') 행 일괄 fetch.
 *   2. active 행 부재 → PROMPT_NOT_FOUND.
 *   3. canary 행 + canary_ratio > 0 → sampleForCanary(userId, promptName) < ratio 시 canary, 그 외 active.
 *   4. canary 부재 또는 ratio=0 → active.
 *
 * deterministic 보장: 동일 userId + promptName → 동일 sample → 동일 row.
 * (인천 분산 / 리프레쉬 / 캐시 무효화 없이 사용자별 안정적 노출.)
 *
 * 호출자 책임: promptName 매핑 (6모드는 MODE_TO_PROMPT_NAME, today 는 'today_with_relation'/'daily_hap').
 */
export async function loadPromptForUser(
  client: SupabaseClient,
  promptName: string,
  userId: string,
): Promise<PromptVersion> {
  const { data, error } = await client
    .from('prompt_versions')
    .select('*')
    .eq('prompt_name', promptName)
    .in('status', ['active', 'canary']);

  if (error) {
    throw new Error(`prompt_versions query failed: ${error.message}`);
  }
  const rows = (data ?? []) as PromptVersion[];
  if (rows.length === 0) {
    throw new Error(`PROMPT_NOT_FOUND: ${promptName}`);
  }

  const active = rows.find((r) => r.status === 'active');
  if (!active) {
    throw new Error(`PROMPT_NOT_FOUND: ${promptName}`);
  }

  const canary = rows.find((r) => r.status === 'canary');
  if (canary && typeof canary.canary_ratio === 'number' && canary.canary_ratio > 0) {
    const sample = sampleForCanary(userId, promptName);
    if (sample < canary.canary_ratio) {
      return canary;
    }
  }
  return active;
}

/**
 * Deterministic 0~1 sample. SHA-256(userId + '::' + promptName) 첫 4바이트 → uint32 / 0xffffffff.
 * - 동일 입력 → 동일 출력 (테스트·운영 동일 결과).
 * - 다른 userId / promptName → 사실상 독립 (충돌 확률 ~2^-32).
 */
export function sampleForCanary(userId: string, promptName: string): number {
  const seed = `${userId}::${promptName}`;
  const hash = createHash('sha256').update(seed).digest();
  const u32 = hash.readUInt32BE(0);
  return u32 / 0xffffffff;
}
