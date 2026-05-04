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

// Q6 잠금: status='active' 행만. canary 무시.
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
