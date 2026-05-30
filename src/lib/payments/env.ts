import { ConfigError } from '@/lib/supabase/env';

const CLIENT_KEY_ENV = 'TOSS_CLIENT_KEY';
const CLIENT_KEY_LEGACY_ENV = 'TOSS_PAYMENTS_CLIENT_KEY';
const SECRET_KEY_ENV = 'TOSS_SECRET_KEY';
const SECRET_KEY_LEGACY_ENV = 'TOSS_PAYMENTS_SECRET_KEY';

export function getTossPaymentsClientKey(): string {
  const key = process.env[CLIENT_KEY_ENV] ?? process.env[CLIENT_KEY_LEGACY_ENV];
  if (!key) {
    throw new ConfigError(`Missing env: ${CLIENT_KEY_ENV}`);
  }
  return key;
}

export function getTossPaymentsSecretKey(): string {
  const key = process.env[SECRET_KEY_ENV] ?? process.env[SECRET_KEY_LEGACY_ENV];
  if (!key) {
    throw new ConfigError(`Missing env: ${SECRET_KEY_ENV}`);
  }
  return key;
}
