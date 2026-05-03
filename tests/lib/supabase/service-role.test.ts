import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const supabaseJsCreateClient = vi.fn(() => ({ from: vi.fn(), auth: {} })) as unknown as ReturnType<typeof vi.fn>;
vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseJsCreateClient,
}));

describe('service-role client', () => {
  beforeEach(() => {
    vi.resetModules();
    supabaseJsCreateClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function lastCallArgs(): unknown[] {
    const calls = supabaseJsCreateClient.mock.calls as unknown[][];
    return calls[calls.length - 1] ?? [];
  }

  it('createServiceRoleClient uses SUPABASE_SERVICE_ROLE_KEY', async () => {
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
    createServiceRoleClient();
    expect(supabaseJsCreateClient).toHaveBeenCalled();
    const args = lastCallArgs();
    expect(args[1]).toBe('service-role-secret');
  });

  it('does NOT use NEXT_PUBLIC_SUPABASE_ANON_KEY', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-should-not-leak';
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
    createServiceRoleClient();
    const args = lastCallArgs();
    expect(args[1]).not.toBe('anon-key-should-not-leak');
    expect(args[1]).toBe('service-role-secret');
  });

  it('throws if SUPABASE_SERVICE_ROLE_KEY missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
    expect(() => createServiceRoleClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('passes auth options that disable session persistence', async () => {
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
    createServiceRoleClient();
    const args = lastCallArgs();
    const opts = args[2] as { auth?: { persistSession?: boolean; autoRefreshToken?: boolean } } | undefined;
    expect(opts?.auth?.persistSession).toBe(false);
  });
});
