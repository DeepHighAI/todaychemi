import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('Supabase browser client', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('creates client with public URL and anon key', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('exposes from() and auth methods', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    expect(typeof supabase.from).toBe('function');
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.getUser).toBe('function');
  });

  it('throws ConfigError if NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { createClient } = await import('@/lib/supabase/client');
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('throws ConfigError if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { createClient } = await import('@/lib/supabase/client');
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
