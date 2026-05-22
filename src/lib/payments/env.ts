import { ConfigError } from '@/lib/supabase/env';

export function getTossPaymentsClientKey(): string {
  const key = process.env.TOSS_PAYMENTS_CLIENT_KEY;
  if (!key) {
    throw new ConfigError('Missing env: TOSS_PAYMENTS_CLIENT_KEY');
  }
  return key;
}

export function getTossPaymentsSecretKey(): string {
  const key = process.env.TOSS_PAYMENTS_SECRET_KEY;
  if (!key) {
    throw new ConfigError('Missing env: TOSS_PAYMENTS_SECRET_KEY');
  }
  return key;
}
