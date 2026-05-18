// @vitest-environment jsdom
// Tests for Step 1: name/page.tsx (별명 + 성별)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../../utils/render-with-intl';

vi.mock('zustand/middleware', () => ({
  persist: (fn: (set: unknown, get: unknown, api: unknown) => unknown) => fn,
}));

vi.mock('next/navigation', () => ({ useRouter: vi.fn(), usePathname: vi.fn() }));

import { useRouter } from 'next/navigation';

const mockPush = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, back: vi.fn() } as never);
  const { useRelationDraft } = await import('@/lib/relations/draft-store');
  useRelationDraft.getState().reset();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('RelationsNamePage (Step 1)', () => {
  it('renders Step 1 headline', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/name/page');
    renderWithIntl(<Page />);
    expect(screen.getByText(/어떤 인연을/)).toBeTruthy();
  });

  it('다음 is disabled until nickname and gender are filled', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/name/page');
    renderWithIntl(<Page />);
    const next = screen.getByRole('button', { name: '다음' });
    expect(next).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/별명/), '하늘');
    expect(next).toBeDisabled(); // gender 미선택

    await user.click(screen.getByRole('radio', { name: '여' }));
    await waitFor(() => expect(next).toBeEnabled());
  });

  it('다음 navigates to /relations/new/dob-time', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/name/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/별명/), '하늘');
    await user.click(screen.getByRole('radio', { name: '여' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(mockPush).toHaveBeenCalledWith('/relations/new/dob-time');
  });
});
