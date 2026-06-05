import { ConfigError } from '@/lib/config-error';

const CLIENT_KEY_ENV = 'TOSS_CLIENT_KEY';
const PUBLIC_CLIENT_KEY_ENV = 'NEXT_PUBLIC_TOSS_CLIENT_KEY';
const CLIENT_KEY_LEGACY_ENV = 'TOSS_PAYMENTS_CLIENT_KEY';
const SECRET_KEY_ENV = 'TOSS_SECRET_KEY';
const SECRET_KEY_LEGACY_ENV = 'TOSS_PAYMENTS_SECRET_KEY';

const DOCS_WIDGET_CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const DOCS_WIDGET_SECRET_KEY = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

const WIDGET_CLIENT_KEY_PATTERN = /^(test|live)_gck(?:_docs)?_[A-Za-z0-9]+$/;
const WIDGET_SECRET_KEY_PATTERN = /^(test|live)_gsk(?:_docs)?_[A-Za-z0-9]+$/;

export function getTossPaymentsClientKey(): string {
  const key =
    envValue(CLIENT_KEY_ENV) ??
    envValue(PUBLIC_CLIENT_KEY_ENV) ??
    envValue(CLIENT_KEY_LEGACY_ENV);
  if (!key) {
    if (shouldUseDocsWidgetKeys()) return DOCS_WIDGET_CLIENT_KEY;
    throw new ConfigError(`Missing env: ${CLIENT_KEY_ENV}`);
  }
  validateTossKey(key, WIDGET_CLIENT_KEY_PATTERN, CLIENT_KEY_ENV, 'test_gck_* or live_gck_*');
  return key;
}

export function getTossPaymentsSecretKey(): string {
  const key = envValue(SECRET_KEY_ENV) ?? envValue(SECRET_KEY_LEGACY_ENV);
  if (!key) {
    if (shouldUseDocsWidgetKeys()) return DOCS_WIDGET_SECRET_KEY;
    throw new ConfigError(`Missing env: ${SECRET_KEY_ENV}`);
  }
  validateTossKey(key, WIDGET_SECRET_KEY_PATTERN, SECRET_KEY_ENV, 'test_gsk_* or live_gsk_*');
  return key;
}

function envValue(key: string): string | null {
  const value = process.env[key]?.trim();
  return value ? value : null;
}

function shouldUseDocsWidgetKeys(): boolean {
  const override = process.env.TOSS_USE_DOCS_WIDGET_KEYS?.trim();
  if (override === '1') return true;
  if (override === '0') return false;

  return process.env.VERCEL_ENV !== 'production' && process.env.TOSS_ENV !== 'production';
}

function validateTossKey(key: string, pattern: RegExp, envName: string, expected: string) {
  if (!pattern.test(key)) {
    throw new ConfigError(`${envName} must be a Toss Payment Widget key (${expected})`);
  }
}
