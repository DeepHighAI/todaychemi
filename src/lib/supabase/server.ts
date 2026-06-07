import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/types/database.types';

import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { getSupabasePublicConfig } from './env';

// Server (RSC / Route Handler / Server Action) Supabase client.
// Pattern: docs/patterns/nextjs15_supabase_ssr.md section 2.
export async function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (err) {
          console.warn('[supabase] cookie setAll failed (expected in RSC)', {
            error: sanitizeErrorForLog(err),
          });
          // RSC: cookies() read-only. middleware refreshes session cookies.
        }
      },
    },
  });
}
