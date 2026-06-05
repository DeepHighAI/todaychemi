import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { isProductionOrigin, LAUNCH_ENV_CHECKS } from '../../scripts/verify-launch-env';

const source = readFileSync(
  new URL('../../scripts/verify-launch-env.ts', import.meta.url),
  'utf8',
);

describe('verify-launch-env script', () => {
  it('keeps launch env shape checks aligned with external setup requirements', () => {
    expect(LAUNCH_ENV_CHECKS.map((check) => check.key)).toEqual([
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'OPENAI_PROJECT_ID',
      'KASI_SERVICE_KEY',
      'TOSS_CLIENT_KEY',
      'TOSS_SECRET_KEY',
      'NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY',
      'KAKAO_ADMIN_KEY',
      'LLM_DAILY_BUDGET_USD',
      'ANTHROPIC_API_KEY',
      'SENTRY_DSN',
      'NEXT_PUBLIC_SENTRY_DSN',
    ]);
    expect(source).toContain('Value shape checks:');
    expect(source).toContain('NEXT_PUBLIC_APP_URL is https production origin without trailing slash');
    expect(source).toContain('OPENAI_PROJECT_ID uses proj_* format');
    expect(source).toContain('/^proj_[A-Za-z0-9]+$/');
    expect(source).toContain('TOSS_CLIENT_KEY uses live_gck_* prefix');
    expect(source).toContain('TOSS_SECRET_KEY uses live_gsk_* prefix');
    expect(source).toContain('LLM_DAILY_BUDGET_USD is a positive number');
    expect(source).toContain("key: 'ANTHROPIC_API_KEY'");
    expect(source).toMatch(/key:\s*'ANTHROPIC_API_KEY'[\s\S]{0,120}severity:\s*'required'/);
    expect(source).toMatch(/key:\s*'SENTRY_DSN'[\s\S]{0,120}severity:\s*'required'/);
    expect(source).toMatch(/key:\s*'NEXT_PUBLIC_SENTRY_DSN'[\s\S]{0,120}severity:\s*'required'/);
    expect(source).toContain('TOSS_PAYMENTS_CLIENT_KEY legacy alias is unset');
    expect(source).toContain('TOSS_PAYMENTS_SECRET_KEY legacy alias is unset');
    expect(source).toContain('Env value shape issue detected');
  });

  it('accepts a fixed Vercel production URL as the MVP production origin', () => {
    expect(isProductionOrigin('https://twoday-mvp.vercel.app')).toBe(true);
  });

  it('rejects local, pathful, and trailing-slash app origins', () => {
    expect(isProductionOrigin('http://twoday-mvp.vercel.app')).toBe(false);
    expect(isProductionOrigin('https://localhost:3000')).toBe(false);
    expect(isProductionOrigin('https://127.0.0.1:3000')).toBe(false);
    expect(isProductionOrigin('https://twoday-mvp.vercel.app/auth/callback')).toBe(false);
    expect(isProductionOrigin('https://twoday-mvp.vercel.app/')).toBe(false);
  });
});
