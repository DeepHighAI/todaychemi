// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';

vi.mock('@/lib/legal/client-consent', () => ({
  recordLegalConsent: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { recordLegalConsent } from '@/lib/legal/client-consent';

const mockPush = vi.fn();
const mockRecordLegalConsent = vi.mocked(recordLegalConsent);

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

async function renderGuestStartPage() {
  const { default: GuestStartPage } = await import('@/app/guest/start/page');
  return render(<GuestStartPage />);
}

describe('/guest/start', () => {
  it('requires legal consent before guest onboarding starts', async () => {
    await renderGuestStartPage();

    expect(screen.getByRole('button', { name: '동의하고 시작하기' })).toBeDisabled();
  });

  it('records guest legal consent and moves to onboarding', async () => {
    mockRecordLegalConsent.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderGuestStartPage();

    await user.click(screen.getByLabelText(/이용약관/));
    await user.click(screen.getByLabelText(/개인정보처리방침/));
    await user.click(screen.getByLabelText(/만 14세 이상/));
    await user.click(screen.getByRole('button', { name: '동의하고 시작하기' }));

    await waitFor(() =>
      expect(mockRecordLegalConsent).toHaveBeenCalledWith(
        { terms: true, privacy: true, age: true },
        'guest',
      ),
    );
    expect(window.sessionStorage.getItem('osa_guest_legal_ready')).toBe('1');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/dob');
  });
});
