// @vitest-environment jsdom
// Tests for Step 2: dob-time/page.tsx (생년월일 + 시간)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
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

/** Opens the BirthDateField tray and clicks day 5. */
function selectBirthDate() {
  fireEvent.click(document.querySelector('.mock-input')!);
  const day5 = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(
    (el) => el.textContent === '5',
  ) as HTMLElement;
  fireEvent.click(day5);
  // use [0] — both date and time fields may be rendered simultaneously
  fireEvent.click(screen.getAllByText('완료')[0]);
}

describe('RelationsDobTimePage (Step 2)', () => {
  it('renders Step 2 headline', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/dob-time/page');
    renderWithIntl(<Page />);
    expect(screen.getByText(/인연의 생년월일을/)).toBeTruthy();
  });

  it('"몰라요" hides BirthTimeField', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/dob-time/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    await waitFor(() => expect(document.querySelectorAll('.mock-input').length).toBe(1));
  });

  it('다음 is disabled until birthDate is set', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/dob-time/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    // 몰라요 → only date required
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    selectBirthDate();
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
  });

  it('다음 navigates to /relations/new/mode', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/dob-time/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    // 몰라요 → only date required
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    selectBirthDate();
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(mockPush).toHaveBeenCalledWith('/relations/new/mode');
  });
});
