// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../utils/render-with-intl';

vi.mock('@/lib/auth/google', () => ({
  signInWithGoogle: vi.fn(),
}));

vi.mock('@/lib/auth/kakao', () => ({
  signInWithKakao: vi.fn(),
}));

vi.mock('@/lib/auth/email', () => ({
  signInWithEmail: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}));

import { signInWithGoogle } from '@/lib/auth/google';
import { signInWithKakao } from '@/lib/auth/kakao';
import { signInWithEmail } from '@/lib/auth/email';

const mockSignInWithGoogle = vi.mocked(signInWithGoogle);
const mockSignInWithKakao = vi.mocked(signInWithKakao);
const mockSignInWithEmail = vi.mocked(signInWithEmail);
const mockRouterPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockRouterPush.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderLoginPage() {
  const { default: LoginPage } = await import('@/app/(auth)/login/page');
  return renderWithIntl(<LoginPage />);
}

describe('LoginPage', () => {
  it('renders title and OAuth button texts from ko.json', async () => {
    await renderLoginPage();

    expect(screen.getByRole('heading', { name: '오늘사이 로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google로 시작하기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeEnabled();
    expect(screen.queryByText('소셜 로그인 필수 동의')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '잠깐 둘러보기' })).toHaveAttribute(
      'href',
      '/guest/start',
    );
  });

  it('clicking Google button calls signInWithGoogle', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }));

    await waitFor(() =>
      expect(mockSignInWithGoogle).toHaveBeenCalledWith(
        {
          terms: false,
          privacy: false,
          age: false,
        },
        { next: '/', deferLegalConsent: true },
      ),
    );
  });

  it('shows loading text while signInWithGoogle is pending', async () => {
    let resolve: () => void;
    mockSignInWithGoogle.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }));

    expect(screen.getAllByRole('button', { name: '연결 중...' }).length).toBeGreaterThan(0);
    resolve!();
  });

  it('disables the button while loading', async () => {
    let resolve: () => void;
    mockSignInWithGoogle.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }));

    for (const button of screen.getAllByRole('button', { name: '연결 중...' })) {
      expect(button).toBeDisabled();
    }
    resolve!();
  });

  it('shows errorGeneric text when signInWithGoogle rejects', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('provider error'));
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }));

    await screen.findByText('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
  });

  it('clicking Kakao button calls signInWithKakao', async () => {
    mockSignInWithKakao.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: '카카오로 시작하기' }));

    await waitFor(() =>
      expect(mockSignInWithKakao).toHaveBeenCalledWith(
        {
          terms: false,
          privacy: false,
          age: false,
        },
        { next: '/', deferLegalConsent: true },
      ),
    );
  });
});

describe('LoginPage — Email/Password', () => {
  it('renders email input, password input, and submit button', async () => {
    await renderLoginPage();

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이메일로 로그인' })).toBeInTheDocument();
  });

  it('submit calls signInWithEmail with entered email and password', async () => {
    mockSignInWithEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderLoginPage();

    await user.type(screen.getByLabelText('이메일'), 'test@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'secret123');
    await user.click(screen.getByRole('button', { name: '이메일로 로그인' }));

    await waitFor(() =>
      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'secret123'),
    );
  });

  it('calls router.push("/") on successful sign-in', async () => {
    mockSignInWithEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderLoginPage();

    await user.type(screen.getByLabelText('이메일'), 'test@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'secret123');
    await user.click(screen.getByRole('button', { name: '이메일로 로그인' }));

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/'));
  });

  it('shows errorInvalidCredentials message when signInWithEmail rejects', async () => {
    mockSignInWithEmail.mockRejectedValue(new Error('Invalid login credentials'));
    const user = userEvent.setup();
    await renderLoginPage();

    await user.type(screen.getByLabelText('이메일'), 'test@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'wrong');
    await user.click(screen.getByRole('button', { name: '이메일로 로그인' }));

    await screen.findByText('이메일 또는 비밀번호가 올바르지 않아요.');
  });

  it('shows errorEmailRequired when submitting with empty email', async () => {
    const user = userEvent.setup();
    await renderLoginPage();

    await user.type(screen.getByLabelText('비밀번호'), 'secret123');
    await user.click(screen.getByRole('button', { name: '이메일로 로그인' }));

    await screen.findByText('이메일을 입력해주세요.');
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  it('renders signup link pointing to /signup', async () => {
    await renderLoginPage();

    const link = screen.getByRole('link', { name: /가입하기/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/signup');
  });
});
