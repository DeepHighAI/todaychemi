import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { redirect } from 'next/navigation';
import AppPage from '@/app/(app)/page';

beforeEach(() => {
  vi.clearAllMocks();
});

it('/app 페이지는 /feed 로 리다이렉트해야 한다', () => {
  AppPage();
  expect(vi.mocked(redirect)).toHaveBeenCalledWith('/feed');
});
