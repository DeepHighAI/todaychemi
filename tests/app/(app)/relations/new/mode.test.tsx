// @vitest-environment jsdom
// Tests for Step 3: mode/page.tsx (6모드 카드 + 동의 + 제출)

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
const mockFetch = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, back: vi.fn() } as never);
  vi.stubGlobal('fetch', mockFetch);
  const { useRelationDraft } = await import('@/lib/relations/draft-store');
  const s = useRelationDraft.getState();
  s.reset();
  s.setNickname('하늘');
  s.setGender('F');
  s.setBirthDate('1995-11-05');
  s.setKnowledge('exact');
  s.setBirthTime('14:20');
  s.setCalendar('solar');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('RelationsModePage (Step 3)', () => {
  it('renders 6 mode cards', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithIntl(<Page />);
    expect(screen.getByText('끌리는 사이')).toBeTruthy();
    expect(screen.getByText('오래 알고 지낸 사이')).toBeTruthy();
    expect(screen.getByText('일로 연결된 사이')).toBeTruthy();
    expect(screen.getByText('친구 사이')).toBeTruthy();
    expect(screen.getByText('돈이 오가는 사이')).toBeTruthy();
    expect(screen.getByText('처음 보는 사이')).toBeTruthy();
  });

  it('등록하기 is disabled until mode and consent are set', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithIntl(<Page />);
    const submit = screen.getByRole('button', { name: '등록하기' });
    expect(submit).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByText('끌리는 사이'));
    expect(submit).toBeDisabled(); // consent 미체크
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('submits with correct body and redirects to /feed?focus=', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ relation_id: 'r-77' }),
    });
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByText('끌리는 사이'));
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed?focus=r-77'));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.nickname).toBe('하늘');
    expect(body.gender).toBe('F');
    expect(body.mode).toBe('썸합');
    expect(body.birth_date).toBe('1995-11-05');
    expect(body.consent_confirmed).toBe(true);
  });

  it('shows generic error on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByText('끌리는 사이'));
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(screen.getByText(/저장에 실패/)).toBeTruthy());
  });
});
