import { ConfigError } from '@/lib/config-error';

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new ConfigError('Missing env: SUPABASE_SERVICE_ROLE_KEY');
  }
  return key;
}
