import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';

// ── hoisted mocks ───────────────────────────────────────────────────────────
const { mockLogin } = vi.hoisted(() => ({ mockLogin: vi.fn().mockResolvedValue(undefined) }));
const { mockReset } = vi.hoisted(() => ({ mockReset: vi.fn() }));
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
const { mockInvalidate } = vi.hoisted(() => ({ mockInvalidate: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'tok', isAuthed: true, isLoading: false, login: mockLogin, logout: vi.fn() }),
}));

vi.mock('@/lib/onboarding/draft-store', () => ({
  useOnboardingDraft: () => ({
    nickname: '테스트',
    birthDate: '1990-01-01',
    calendar: 'solar',
    knowledge: 'exact',
    birthTime: '08:00',
    gender: 'M',
    reset: mockReset,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// apiFetch 만 스텁, ApiError 실클래스 유지(instanceof 분기 검증)
vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return { ...actual, apiFetch: vi.fn() };
});

// useQueryClient 만 스텁(invalidate 호출 검증). QueryClientProvider 등 나머지는 실제 유지.
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidate }) };
});

import { Step4Review } from './Step4Review';
import { apiFetch, ApiError } from '@/lib/api/client';

const mockApiFetch = vi.mocked(apiFetch);

function checkAllConsents() {
  return Promise.all([
    userEvent.click(screen.getByRole('checkbox', { name: '이용약관에 동의합니다' })),
    userEvent.click(screen.getByRole('checkbox', { name: '개인정보처리방침에 동의합니다' })),
    userEvent.click(screen.getByRole('checkbox', { name: '만 14세 이상입니다' })),
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockResolvedValue({} as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Step4Review — 동의 게이팅', () => {
  it('동의 전에는 제출 버튼이 비활성이다', () => {
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled();
  });

  it('필수 동의 3개를 모두 체크하면 제출 버튼이 활성된다', async () => {
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    await checkAllConsents();
    expect(screen.getByRole('button', { name: '시작하기' })).toBeEnabled();
  });
});

describe('Step4Review — 제출 흐름', () => {
  it('동의 후 제출 시 consent → onboarding 순서로 호출하고 홈으로 이동한다', async () => {
    const onSubmitSuccess = vi.fn();
    renderWithProviders(<Step4Review onSubmitSuccess={onSubmitSuccess} />);
    await checkAllConsents();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/toss/consent');
    expect(mockApiFetch.mock.calls[1][0]).toBe('/api/onboarding');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(mockReset).toHaveBeenCalled();
    expect(onSubmitSuccess).toHaveBeenCalled();
  });

  it('성공 시 ["me-chart"] 쿼리를 무효화한다(ProfileGate 재튕김 방지)', async () => {
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    await checkAllConsents();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['me-chart'] }));
  });

  it('consent POST 의 body 는 terms/privacy/age 모두 true 다', async () => {
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    await checkAllConsents();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/api/toss/consent', expect.anything()));
    const consentCall = mockApiFetch.mock.calls.find((c) => c[0] === '/api/toss/consent');
    expect(consentCall?.[1]).toMatchObject({ body: { terms: true, privacy: true, age: true } });
  });
});

describe('Step4Review — 에러 분기', () => {
  it('401 → 세션 만료 메시지 + login() 재호출, 버튼 재활성', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'expired'));
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    await checkAllConsents();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await screen.findByText('세션이 만료되었어요. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(mockLogin).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '시작하기' })).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('401 후 재로그인까지 실패하면 generic 메시지로 폴백한다(거부 미삼킴)', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'expired'));
    mockLogin.mockRejectedValueOnce(new Error('relogin failed'));
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    await checkAllConsents();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    expect(mockLogin).toHaveBeenCalled();
    expect(await screen.findByText('저장에 실패했어요. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시작하기' })).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('403 LEGAL_CONSENT_REQUIRED → 동의 안내 메시지', async () => {
    mockApiFetch
      .mockResolvedValueOnce({} as never) // consent OK
      .mockRejectedValueOnce(new ApiError(403, 'LEGAL_CONSENT_REQUIRED', 'consent')); // onboarding
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    await checkAllConsents();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await screen.findByText('약관 동의가 필요해요. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('기타 오류 → generic 메시지', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    renderWithProviders(<Step4Review onSubmitSuccess={vi.fn()} />);
    await checkAllConsents();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await screen.findByText('저장에 실패했어요. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
  });
});
