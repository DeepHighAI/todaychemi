import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Today root page', () => {
  it('redirects unauthenticated users to /start before rendering the app home', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const { default: TodayPage } = await import('@/app/(app)/page');

    await expect(TodayPage()).rejects.toThrow('NEXT_REDIRECT:/start');
  });
});
