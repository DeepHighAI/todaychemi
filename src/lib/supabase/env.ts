// Supabase 환경변수 검증 — 누락 시 ConfigError throw.
// 클라이언트/서버 양쪽에서 호출 가능 (NEXT_PUBLIC_ 키는 양쪽 모두 접근 가능).

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) {
    throw new ConfigError('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!anonKey) {
    throw new ConfigError('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}

// 서비스 롤 키는 서버에서만. 호출 시점에 환경 검증.
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new ConfigError('Missing env: SUPABASE_SERVICE_ROLE_KEY');
  }
  return key;
}
