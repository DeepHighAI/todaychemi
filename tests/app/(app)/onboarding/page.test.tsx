// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../utils/render-with-intl';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/onboarding/tos', () => ({
  TOS_VERSION: 'v0.1',
}));

import { useRouter } from 'next/navigation';

const mockPush = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderOnboardingPage() {
  const { default: OnboardingPage } = await import('@/app/(app)/onboarding/page');
  return renderWithIntl(<OnboardingPage />);
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('나를 부를 별명'), '하늘달');
  const dobInput = screen.getByLabelText('생년월일');
  await user.type(dobInput, '1991-03-15');
  // gender 남 선택
  await user.click(screen.getByRole('radio', { name: '남' }));
  // 시간 정확도 기본값 '정확해요' — birth_time 필드 나타남
  const timeInput = screen.getByLabelText('시간 입력');
  await user.type(timeInput, '14:30');
  // ToS 동의
  await user.click(screen.getByRole('checkbox'));
}

describe('OnboardingPage', () => {
  it('renders two section headings', async () => {
    await renderOnboardingPage();
    expect(screen.getByText('기본 정보')).toBeInTheDocument();
    expect(screen.getByText('출생 시간')).toBeInTheDocument();
  });

  it('renders nickname input with placeholder', async () => {
    await renderOnboardingPage();
    expect(screen.getByPlaceholderText('나를 부를 별명')).toBeInTheDocument();
  });

  it('renders time accuracy toggle with 3 options', async () => {
    await renderOnboardingPage();
    expect(screen.getByRole('radio', { name: '정확해요' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '대략 알아요' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '몰라요' })).toBeInTheDocument();
  });

  it('hides birth_time input when unknown selected, shows hint text', async () => {
    const user = userEvent.setup();
    await renderOnboardingPage();
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    expect(screen.queryByLabelText('시간 입력')).not.toBeInTheDocument();
    expect(screen.getByText('정오 12:00로 가정해 추정해요')).toBeInTheDocument();
  });

  it('shows birth_time input when exact is selected', async () => {
    const user = userEvent.setup();
    await renderOnboardingPage();
    expect(screen.getByLabelText('시간 입력')).toBeInTheDocument();
  });

  it('submit button is disabled when tos unchecked', async () => {
    await renderOnboardingPage();
    const submit = screen.getByRole('button', { name: '시작하기' });
    expect(submit).toBeDisabled();
  });

  it('submit button becomes enabled after tos checked', async () => {
    const user = userEvent.setup();
    await renderOnboardingPage();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: '시작하기' })).not.toBeDisabled();
  });

  it('shows nicknameRequired error when submitting with empty nickname', async () => {
    const user = userEvent.setup();
    await renderOnboardingPage();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    expect(await screen.findByText('별명을 입력해주세요.')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls POST /api/onboarding and redirects to /feed on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    await renderOnboardingPage();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/onboarding',
      expect.objectContaining({ method: 'POST' }),
    ));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed'));
  });

  it('shows generic error when POST returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'INTERNAL_ERROR' }) });
    const user = userEvent.setup();
    await renderOnboardingPage();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await screen.findByText('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
