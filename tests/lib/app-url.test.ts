import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppOrigin } from '@/lib/app-url';

describe('getAppOrigin', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('NEXT_PUBLIC_APP_URL 설정 시 해당 값을 반환', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    expect(getAppOrigin()).toBe('https://example.com');
  });

  it('NEXT_PUBLIC_APP_URL 후행 슬래시를 제거', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com/');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    expect(getAppOrigin()).toBe('https://example.com');
  });

  it('NEXT_PUBLIC_APP_URL 미설정 + VERCEL_PROJECT_PRODUCTION_URL 설정 시 https:// 프리픽스 반환', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'my-app.vercel.app');
    expect(getAppOrigin()).toBe('https://my-app.vercel.app');
  });

  it('둘 다 미설정 시 localhost:3000 반환', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    expect(getAppOrigin()).toBe('http://localhost:3000');
  });

  it('NEXT_PUBLIC_APP_URL 이 공백 문자열이면 Vercel fallback 사용', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '   ');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'my-app.vercel.app');
    expect(getAppOrigin()).toBe('https://my-app.vercel.app');
  });
});
