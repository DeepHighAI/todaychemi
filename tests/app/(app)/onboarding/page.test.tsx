// @vitest-environment jsdom
// Tests for URL-based onboarding step pages

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../utils/render-with-intl';

// persist → passthrough so zustand store works normally without localStorage
vi.mock('zustand/middleware', () => ({
  persist: (fn: (set: unknown, get: unknown, api: unknown) => unknown) => fn,
  createJSONStorage: () => undefined,
}));

vi.mock('next/navigation', () => ({ useRouter: vi.fn(), usePathname: vi.fn() }));

import { useRouter, usePathname } from 'next/navigation';

const mockPush = vi.fn();
const mockFetch = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, back: vi.fn() } as never);
  vi.mocked(usePathname).mockReturnValue('/onboarding/dob');
  vi.stubGlobal('fetch', mockFetch);
  // Reset draft store
  const { useOnboardingDraft } = await import('@/lib/onboarding/draft-store');
  useOnboardingDraft.getState().reset();
});
afterEach(() => { vi.unstubAllGlobals(); });

/** Opens the BirthDateField tray and clicks day 5. */
function selectBirthDate() {
  fireEvent.click(document.querySelector('.mock-input')!);
  const day5 = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(el => el.textContent === '5') as HTMLElement;
  fireEvent.click(day5);
  fireEvent.click(screen.getByText('완료'));
}

/** Opens the BirthTimeField tray and confirms default 14:20. */
function selectBirthTime() {
  fireEvent.click(document.querySelector('.mock-input')!);
  fireEvent.click(screen.getByText('완료'));
}

describe('OnboardingDobPage (Step 1)', () => {
  it('renders Step 1 headline', async () => {
    const { default: Page } = await import('@/app/(app)/onboarding/dob/page');
    renderWithIntl(<Page />);
    expect(screen.getByText(/처음 오셨네요/)).toBeTruthy();
  });

  it('다음 is disabled until nickname and date are filled', async () => {
    const { default: Page } = await import('@/app/(app)/onboarding/dob/page');
    renderWithIntl(<Page />);
    const next = screen.getByRole('button', { name: '다음' });
    expect(next).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
    expect(next).toBeDisabled();
    selectBirthDate();
    await waitFor(() => expect(next).toBeEnabled());
  });

  it('다음 navigates to /onboarding/time', async () => {
    const { default: Page } = await import('@/app/(app)/onboarding/dob/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
    selectBirthDate();
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/time');
  });
});

describe('OnboardingTimePage (Step 2)', () => {
  it('renders Step 2 headline', async () => {
    const { default: Page } = await import('@/app/(app)/onboarding/time/page');
    renderWithIntl(<Page />);
    expect(screen.getByText(/태어난 시간/)).toBeTruthy();
  });

  it('"몰라요" hides BirthTimeField and shows hint', async () => {
    const { default: Page } = await import('@/app/(app)/onboarding/time/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    await waitFor(() => expect(document.querySelector('.mock-input')).toBeNull());
    expect(screen.getByText(/정오 12:00/)).toBeTruthy();
  });
});

describe('OnboardingCalGenderPage (Step 3)', () => {
  it('renders gender options', async () => {
    const { default: Page } = await import('@/app/(app)/onboarding/cal-gender/page');
    renderWithIntl(<Page />);
    expect(screen.getAllByRole('radio').length).toBeGreaterThanOrEqual(2);
  });

  it('다음 is disabled until gender is selected', async () => {
    const { default: Page } = await import('@/app/(app)/onboarding/cal-gender/page');
    renderWithIntl(<Page />);
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: '남' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
  });
});

describe('OnboardingReviewPage (Step 4)', () => {
  beforeEach(async () => {
    const { useOnboardingDraft } = await import('@/lib/onboarding/draft-store');
    const s = useOnboardingDraft.getState();
    s.setNickname('하늘달');
    s.setBirthDate('1995-11-05');
    s.setBirthTime('14:20');
    s.setKnowledge('exact');
    s.setGender('M');
    s.setCalendar('solar');
  });

  it('시작하기 submits and redirects to /', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { default: Page } = await import('@/app/(app)/onboarding/review/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.birth_date).toBe('1995-11-05');
    expect(body.birth_time).toBe('14:20');
  });

  it('게스트 동의 상태에서는 오늘 나의 흐름을 생성하고 /today/me로 이동한다', async () => {
    window.sessionStorage.setItem('osa_guest_legal_ready', '1');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        card: {
          headline: '오늘은 정리하기 좋아요.',
          headline_reason: '차분한 흐름입니다.',
          avoid_phrase: '급한 말',
          avoid_phrase_reason: '서두르지 마세요.',
          favorable_action: '정리하기',
          favorable_action_reason: '작은 정리가 좋아요.',
          reused_from_yesterday: false,
        },
        chart: {
          year_pillar: '갑자',
          month_pillar: '을축',
          day_pillar: '병인',
          hour_pillar: null,
          day_master_element: '화',
          five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
          gender_normalized: 'M',
          yunse: {
            daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 },
            seyun: { current_pillar: '병오', current_year: 2026 },
            wolun: { current_pillar: '계사', current_month: '2026-05' },
            iliun: { today_pillar: '갑자', today_date: '2026-05-07' },
          },
        },
      }),
    });
    const { default: Page } = await import('@/app/(app)/onboarding/review/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '시작하기' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/guest/today', expect.any(Object)));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/today/me'));
    expect(window.sessionStorage.getItem('osa_guest_today')).toContain('오늘은 정리하기 좋아요.');
  });

  it('shows generic error on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const { default: Page } = await import('@/app/(app)/onboarding/review/page');
    renderWithIntl(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(screen.getByText(/저장에 실패/)).toBeTruthy());
  });
});
