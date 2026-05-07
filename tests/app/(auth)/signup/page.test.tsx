// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../utils/render-with-intl';

vi.mock('@/lib/auth/email', () => ({
  signUpWithEmail: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

import { signUpWithEmail } from '@/lib/auth/email';

const mockSignUpWithEmail = vi.mocked(signUpWithEmail);
const mockRouterPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockRouterPush.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderSignupPage() {
  const { default: SignupPage } = await import('@/app/(auth)/signup/page');
  return renderWithIntl(<SignupPage />);
}

describe('SignupPage', () => {
  it('renders email input, password input, submit button, and login link', async () => {
    await renderSignupPage();

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이메일로 가입' })).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /로그인/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('shows errorEmailRequired when submitting with empty email', async () => {
    const user = userEvent.setup();
    await renderSignupPage();

    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('이메일을 입력해주세요.');
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  it('shows password strength error when password is too short (< 8 chars)', async () => {
    const user = userEvent.setup();
    await renderSignupPage();

    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('비밀번호는 8자 이상이어야 해요.');
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  it('shows password strength error for letters-only password', async () => {
    const user = userEvent.setup();
    await renderSignupPage();

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

    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await waitFor(() =>
      expect(mockSignUpWithEmail).toHaveBeenCalledWith('new@example.com', 'test1234'),
    );
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/onboarding'));
  });

  it('shows errorEmailTaken when signUpWithEmail rejects with status 422', async () => {
    mockSignUpWithEmail.mockRejectedValue({ message: 'User already registered', status: 422 });
    const user = userEvent.setup();
    await renderSignupPage();

    await user.type(screen.getByLabelText('이메일'), 'taken@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('이미 사용 중인 이메일이에요.');
  });

  it('shows errorRateLimited when signUpWithEmail rejects with status 429', async () => {
    mockSignUpWithEmail.mockRejectedValue({ message: 'Too many requests', status: 429 });
    const user = userEvent.setup();
    await renderSignupPage();

    await user.type(screen.getByLabelText('이메일'), 'new@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'test1234');
    await user.click(screen.getByRole('button', { name: '이메일로 가입' }));

    await screen.findByText('요청이 너무 많아요. 잠시 후 다시 시도해주세요.');
  });
});
