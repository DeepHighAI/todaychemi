// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../utils/render-with-intl';

vi.mock('@/lib/auth/google', () => ({
  signInWithGoogle: vi.fn(),
}));

import { signInWithGoogle } from '@/lib/auth/google';

const mockSignInWithGoogle = vi.mocked(signInWithGoogle);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderLoginPage() {
  const { default: LoginPage } = await import('@/app/(auth)/login/page');
  return renderWithIntl(<LoginPage />);
}

describe('LoginPage', () => {
  it('renders title and Google button text from ko.json', async () => {
    await renderLoginPage();

    expect(screen.getByRole('heading', { name: '합플 로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google로 시작하기' })).toBeInTheDocument();
  });

  it('clicking Google button calls signInWithGoogle', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledOnce());
  });

  it('shows loading text while signInWithGoogle is pending', async () => {
    let resolve: () => void;
    mockSignInWithGoogle.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button', { name: '연결 중...' })).toBeInTheDocument();
    resolve!();
  });

  it('disables the button while loading', async () => {
    let resolve: () => void;
    mockSignInWithGoogle.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toBeDisabled();
    resolve!();
  });

  it('shows errorGeneric text when signInWithGoogle rejects', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('provider error'));
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }));

    await screen.findByText('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
  });
});
