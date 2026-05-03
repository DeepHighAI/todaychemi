import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env';

// Service-role Supabase client — admin / system-only.
// PII: birth_date, nickname, email, gender, birth_place — LLM 페이로드 직렬화 금지
// (docs/legal/pii_minimization.md, ADR-004).
//
// 절대 NEXT_PUBLIC_SUPABASE_ANON_KEY 사용 금지.
// 절대 클라이언트 번들에 포함 금지.

export function createServiceRoleClient() {
  // 브라우저 환경에서 호출 시도 차단.
  if (typeof window !== 'undefined') {
    throw new Error('service-role client must not be used in browser');
  }
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();

  return createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
