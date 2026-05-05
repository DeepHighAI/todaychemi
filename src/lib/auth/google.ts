'use client';

import { createClient } from '@/lib/supabase/client';

// Google OAuth 시작. 패턴: docs/patterns/supabase_callback.md.
// PII 5필드는 Auth 응답에서만 받고 LLM 페이로드 직렬화 금지(ADR-004).
export async function signInWithGoogle() {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}
