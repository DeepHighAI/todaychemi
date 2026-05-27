// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../utils/render-with-intl';

vi.mock('@/lib/auth/email', () => ({
  signUpWithEmail: vi.fn(),
}));

vi.mock('@/lib/auth/google', () => ({
  signInWithGoogle: vi.fn(),
}));

vi.mock('@/lib/auth/kakao', () => ({
  signInWithKakao: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  useSearchParams: () => mockSearchParams,
}));

import { signUpWithEmail } from '@/lib/auth/email';
import { signInWithGoogle } from '@/lib/auth/google';
import { signInWithKakao } from '@/lib/auth/kakao';

const mockSignUpWithEmail = vi.mocked(signUpWithEmail);
const mockSignInWithGoogle = vi.mocked(signInWithGoogle);
const mockSignInWithKakao = vi.mocked(signInWithKakao);
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

beforeEach(() => {
  vi.clearAllMocks();
  mockRouterPush.mockReset();
  mockRouterReplace.mockReset();
  mockSearchParams = new URLSearchParams();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderSignupPage() {
  const { default: SignupPage } = await import('@/app/(auth)/signup/page');
  return renderWithIntl(<SignupPage />);
}

async function acceptLegalConsent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/이용약관/));
  await user.click(screen.getByLabelText(/개인정보처리방침/));
  await user.click(screen.getByLabelText(/만 14세 이상/));
}

describe('SignupPage', () => {
  it('renders email input, password input, submit button, and login link', async () => {
    await renderSignupPage();

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이메일로 가입' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이용약관' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '개인정보처리방침' })).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /로그인/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('enables submit only after all required legal consent items are checked', async () => {
    const user = userEvent.setup();
    await renderSignupPage();

    const submit = screen.getByRole('button', { name: '이메일로 가입' });
    expect(submit).toBeDisabled();
    await acceptLegalConsent(user);
    expect(submit).toBeEnabled();
  });

  it('shows errorEmailRequired when submitting with empty email', async () => {
    const user = userEvent.setup();
    await renderSignupPage();

    await acceptLegalConsent(user);
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('이메일을 입력해주세요.');
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  it('shows password strength error when password is too short (< 8 chars)', async () => {
    const user = userEvent.setup();
    await renderSignupPage();

    await acceptLegalConsent(user);
    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('비밀번호는 8자 이상이어야 해요.');
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  it('shows password strength error for letters-only password', async () => {
    const user = userEvent.setup();
    await renderSignupPage();

    await acceptLegalConsent(user);
    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'abcdefgh');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('영문과 숫자를 모두 포함해주세요.');
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  it('calls signUpWithEmail and navigates to /onboarding on success', async () => {
    mockSignUpWithEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderSignupPage();

    await acceptLegalConsent(user);
    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await waitFor(() =>
      expect(mockSignUpWithEmail).toHaveBeenCalledWith(
        'new@example.com',
        'test1234',
        {
          terms: true,
          privacy: true,
          age: true,
        },
        { reuseExistingConsent: false },
      ),
    );
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/onboarding'));
  });

  it('guest intent reuses guest consent and routes email signup to /guest/complete', async () => {
    mockSearchParams = new URLSearchParams('intent=guest');
    window.sessionStorage.setItem(
      'osa_guest_onboarding',
      JSON.stringify({
        nickname: '하늘달',
        birth_date: '1995-11-05',
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: '14:20',
        gender: 'M',
      }),
    );
    mockSignUpWithEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderSignupPage();

    expect(screen.queryByText('회원가입 필수 동의')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await waitFor(() =>
      expect(mockSignUpWithEmail).toHaveBeenCalledWith(
        'new@example.com',
        'test1234',
        expect.any(Object),
        { reuseExistingConsent: true },
      ),
    );
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/guest/complete'));
  });

  it('guest intent Google signup keeps next=/guest/complete without recording new consent', async () => {
    mockSearchParams = new URLSearchParams('intent=guest');
    window.sessionStorage.setItem(
      'osa_guest_onboarding',
      JSON.stringify({
        nickname: '하늘달',
        birth_date: '1995-11-05',
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: '14:20',
        gender: 'M',
      }),
    );
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderSignupPage();

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }));

    await waitFor(() =>
      expect(mockSignInWithGoogle).toHaveBeenCalledWith(
        expect.any(Object),
        { next: '/guest/complete', reuseExistingConsent: true },
      ),
    );
  });

  it('guest intent Kakao signup keeps next=/guest/complete without recording new consent', async () => {
    mockSearchParams = new URLSearchParams('intent=guest');
    window.sessionStorage.setItem(
      'osa_guest_onboarding',
      JSON.stringify({
        nickname: '하늘달',
        birth_date: '1995-11-05',
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: '14:20',
        gender: 'M',
      }),
    );
    mockSignInWithKakao.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderSignupPage();

    await user.click(screen.getByRole('button', { name: '카카오로 시작하기' }));

    await waitFor(() =>
      expect(mockSignInWithKakao).toHaveBeenCalledWith(
        expect.any(Object),
        { next: '/guest/complete', reuseExistingConsent: true },
      ),
    );
  });

  it('shows errorEmailTaken when signUpWithEmail rejects with status 422', async () => {
    mockSignUpWithEmail.mockRejectedValue({ message: 'User already registered', status: 422 });
    const user = userEvent.setup();
    await renderSignupPage();

    await acceptLegalConsent(user);
    await user.type(screen.getByLabelText('이메일'), 'taken@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('이미 사용 중인 이메일이에요.');
  });

  it('shows errorRateLimited when signUpWithEmail rejects with status 429', async () => {
    mockSignUpWithEmail.mockRejectedValue({ message: 'Too many requests', status: 429 });
    const user = userEvent.setup();
    await renderSignupPage();

    await acceptLegalConsent(user);
    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('요청이 너무 많아요. 잠시 후 다시 시도해주세요.');
  });
});
