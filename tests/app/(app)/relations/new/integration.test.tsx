// @vitest-environment jsdom
// Integration: name → dob-time → mode → POST happy path

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
const mockFetch = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, back: vi.fn() } as never);
  vi.stubGlobal('fetch', mockFetch);
  const { useRelationDraft } = await import('@/lib/relations/draft-store');
  useRelationDraft.getState().reset();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Relations New — full 3-step flow', () => {
  it('name → dob-time → mode → POST creates relation and navigates to /feed?focus=', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ relation_id: 'r-77' }),
    });

    // Step 1: name
    const { default: NamePage } = await import('@/app/(app)/relations/new/name/page');
    const { unmount: unmountName } = renderWithIntl(<NamePage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/별명/), '하늘');
    await user.click(screen.getByRole('radio', { name: '여' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(mockPush).toHaveBeenCalledWith('/relations/new/dob-time');
    unmountName();

    // Step 2: dob-time
    const { default: DobTimePage } = await import('@/app/(app)/relations/new/dob-time/page');
    const { unmount: unmountDob } = renderWithIntl(<DobTimePage />);
    const user2 = userEvent.setup();
    await user2.click(screen.getByRole('radio', { name: '몰라요' }));
    fireEvent.click(document.querySelector('.mock-input')!);
    const day5 = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(
      (el) => el.textContent === '5',
    ) as HTMLElement;
    fireEvent.click(day5);
    fireEvent.click(screen.getAllByText('완료')[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
    await user2.click(screen.getByRole('button', { name: '다음' }));
    expect(mockPush).toHaveBeenCalledWith('/relations/new/mode');
    unmountDob();

    // Step 3: mode + submit
    const { default: ModePage } = await import('@/app/(app)/relations/new/mode/page');
    renderWithIntl(<ModePage />);
    const user3 = userEvent.setup();
    await user3.click(screen.getByText('끌리는 사이'));
    await user3.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled());
    await user3.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed?focus=r-77'));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.nickname).toBe('하늘');
    expect(body.gender).toBe('F');
    expect(body.mode).toBe('썸합');
    expect(body.consent_confirmed).toBe(true);
  });
});
