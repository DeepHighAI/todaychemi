// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithIntl } from '../../../utils/render-with-intl';

vi.mock('@/lib/legal/client-consent', () => ({
  recordSocialLegalConsent: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import { recordSocialLegalConsent } from '@/lib/legal/client-consent';
import { SocialConsentClient } from '@/app/auth/social-consent/social-consent-client';

const mockReplace = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockReplace.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: '이용약관',
          version: '2026-06-01',
          markdown: '# 오늘케미 서비스 이용약관',
        }),
        { status: 200 },
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SocialConsentClient', () => {
  it('requires all consent checks before claiming social legal consent', async () => {
    const user = userEvent.setup();
    vi.mocked(recordSocialLegalConsent).mockResolvedValue({ alreadyOnboarded: false });

    renderWithIntl(<SocialConsentClient provider="google" next="/onboarding" />);

    expect(screen.getByRole('heading', { name: '소셜 로그인 필수 동의' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '동의하고 시작하기' })).toBeDisabled();

    await user.click(screen.getByLabelText(/이용약관/));
    await user.click(screen.getByLabelText(/개인정보처리방침/));
    await user.click(screen.getByLabelText(/만 14세 이상/));
    await user.click(screen.getByRole('button', { name: '동의하고 시작하기' }));

    await waitFor(() =>
      expect(recordSocialLegalConsent).toHaveBeenCalledWith(
        { terms: true, privacy: true, age: true },
        'google',
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith('/onboarding');
  });

  it('sends already onboarded users home after submit', async () => {
    const user = userEvent.setup();
    vi.mocked(recordSocialLegalConsent).mockResolvedValue({ alreadyOnboarded: true });

    renderWithIntl(<SocialConsentClient provider="kakao" next="/onboarding" />);

    await user.click(screen.getByLabelText(/이용약관/));
    await user.click(screen.getByLabelText(/개인정보처리방침/));
    await user.click(screen.getByLabelText(/만 14세 이상/));
    await user.click(screen.getByRole('button', { name: '동의하고 시작하기' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
