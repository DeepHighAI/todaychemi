import { ConfigError } from '@/lib/config-error';

// Supabase public environment. This module is safe for Client Components.
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new ConfigError('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  }
  return url;
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = getSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new ConfigError('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}
