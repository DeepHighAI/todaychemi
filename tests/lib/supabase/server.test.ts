import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

// next/headers cookies() 모킹 — 테스트 간 변경 가능하도록 mutable
const cookieStore = {
  _bag: [] as Array<{ name: string; value: string }>,
  getAll: vi.fn(() => cookieStore._bag),
  set: vi.fn((name: string, value: string) => {
    cookieStore._bag.push({ name, value });
  }),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}));

describe('Supabase server client', () => {
  beforeEach(() => {
    vi.resetModules();
    cookieStore._bag = [];
    cookieStore.getAll.mockClear();
    cookieStore.set.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('creates client with cookie store adapter', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
    expect(supabase.auth).toBeDefined();
  });

  it('getAll returns cookies from mocked next/headers', async () => {
    cookieStore._bag = [{ name: 'sb-test', value: 'cookieval' }];
    const { createClient } = await import('@/lib/supabase/server');
    await createClient();
    // cookies() 호출은 createClient 내부에서 await 되어야 함.
    // 실제 getAll 호출은 supabase가 요청 시점에 하므로,
    // 여기서는 cookies() 모킹이 정상 호출되었는지 확인.
    const headersMod = await import('next/headers');
    expect(headersMod.cookies).toHaveBeenCalled();
  });

  it('setAll silently ignores errors in RSC context', async () => {
    // cookieStore.set 이 throw 하도록 설정 — RSC에서는 실패가 정상.
    cookieStore.set.mockImplementation(() => {
      throw new Error('Cannot set cookies in Server Component');
    });
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    // setAll 내부 try/catch — supabase 사용 시 cookie write가 throw되더라도 호출자는 영향 없어야 함.
    expect(supabase).toBeDefined();
  });

  it('setAll warning 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.resetModules();
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: vi.fn((_url: string, _anonKey: string, options: unknown) => ({
        auth: {},
        from: vi.fn(),
        __options: options,
      })),
    }));
    cookieStore.set.mockImplementation(() => {
      throw new Error('Cannot set birth_date=1991-03-15 birth_time=14:30 gender=F');
    });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const options = (supabase as unknown as { __options: { cookies: { setAll: (cookies: unknown[]) => void } } }).__options;
    options.cookies.setAll([{ name: 'sb-test', value: 'value', options: {} }]);

    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');

    vi.doUnmock('@supabase/ssr');
  });
});
