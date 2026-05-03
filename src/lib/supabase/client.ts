import { createBrowserClient } from '@supabase/ssr';

import { getSupabasePublicConfig } from './env';

// Browser (Client Component) Supabase client.
// Pattern: docs/patterns/nextjs15_supabase_ssr.md section 3.
// TODO(C-3): replace any with Database type after database.types.ts ships.
export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
