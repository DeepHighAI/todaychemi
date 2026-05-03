import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database.types';

import { getSupabasePublicConfig } from './env';

// Browser (Client Component) Supabase client.
// Pattern: docs/patterns/nextjs15_supabase_ssr.md section 3.
export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, anonKey);
}
