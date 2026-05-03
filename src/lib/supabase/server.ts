import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabasePublicConfig } from './env';

// Server (RSC / Route Handler / Server Action) Supabase client.
// Pattern: docs/patterns/nextjs15_supabase_ssr.md section 2.
// TODO(C-3): replace any with Database type after database.types.ts ships.
export async function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component에서는 cookies() 가 read-only.
          // middleware가 세션 쿠키를 갱신하므로 여기서는 silent swallow.
        }
      },
    },
  });
}
