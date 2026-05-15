// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../utils/render-with-intl';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/lib/onboarding/tos', () => ({ TOS_VERSION: 'v0.1' }));

import { useRouter } from 'next/navigation';

const mockPush = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => { vi.unstubAllGlobals(); });

async function renderPage() {
  const { default: Page } = await import('@/app/(app)/onboarding/page');
  return renderWithIntl(<Page />);
}

/** Opens the BirthDateField tray and clicks day 5 in the default 1995/11 view. */
function selectBirthDate() {
  fireEvent.click(document.querySelector('.mock-input')!);
  const day5 = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(el => el.textContent === '5') as HTMLElement;
  fireEvent.click(day5);
  fireEvent.click(screen.getByText('완료'));
}

/** Opens the BirthTimeField tray and picks 14:20 (defaults), then confirms. */
function selectBirthTime() {
  fireEvent.click(document.querySelector('.mock-input')!);
  // Default 14:20 is already set — just confirm
  fireEvent.click(screen.getByText('완료'));
}

describe('OnboardingPage', () => {
  it('renders Step 1 headline', async () => {
    await renderPage();
    expect(screen.getByText(/처음 오셨네요/)).toBeTruthy();
  });

  it('다음 is disabled until nickname and date are filled', async () => {
    await renderPage();
    const next = screen.getByRole('button', { name: '다음' });
    expect(next).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
    expect(next).toBeDisabled(); // still need date
    selectBirthDate();
    await waitFor(() => expect(next).toBeEnabled());
  });

  it('advances to Step 2 and shows time picker', async () => {
    await renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
    selectBirthDate();
    const next = screen.getByRole('button', { name: '다음' });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);
    expect(screen.getByText(/태어난 시간/)).toBeTruthy();
    expect(document.querySelector('.mock-input')).toBeTruthy(); // BirthTimeField MockInput
  });

  it('Step 2 "몰라요" hides BirthTimeField MockInput and shows hint', async () => {
    await renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
    selectBirthDate();
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    expect(document.querySelector('.mock-input')).toBeNull();
    expect(screen.getByText(/정오 12:00/)).toBeTruthy();
  });

  it('posts correct birth_date and birth_time and redirects to /feed', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await renderPage();
    const user = userEvent.setup();
    // Step 1
    await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
    selectBirthDate();
    await user.click(screen.getByRole('button', { name: '다음' }));
    // Step 2: confirm default time 14:20
    selectBirthTime();
    await user.click(screen.getByRole('button', { name: '다음' }));
    // Step 3: gender
    await user.click(screen.getByRole('radio', { name: '남' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    // Step 4: ToS
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed'));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.birth_date).toBe('1995-11-05');
    expect(body.birth_time).toBe('14:20');
  });

  it('shows generic error on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
    selectBirthDate();
    await user.click(screen.getByRole('button', { name: '다음' }));
    selectBirthTime();
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('radio', { name: '남' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(screen.getByText(/저장에 실패/)).toBeTruthy());
  });
});
