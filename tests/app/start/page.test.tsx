// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/server');
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { createClient } from '@/lib/supabase/server';

const getUser = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser },
  } as never);
});

describe('/start', () => {
  it('shows first-time and returning-user branch buttons for unauthenticated users', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { default: StartPage } = await import('@/app/start/page');

    render(await StartPage());

    expect(screen.getByRole('link', { name: /처음이세요/ })).toHaveAttribute(
      'href',
      '/guest/start',
    );
    expect(screen.getByRole('link', { name: /우리 만난 적 있죠/ })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('redirects authenticated users to home', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const { default: StartPage } = await import('@/app/start/page');

    await expect(StartPage()).rejects.toThrow('NEXT_REDIRECT:/');
  });
});
