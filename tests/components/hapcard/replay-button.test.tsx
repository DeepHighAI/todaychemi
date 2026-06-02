// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/render-with-providers';

const nav = vi.hoisted(() => ({ replayParam: null as string | null }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.replayParam ? { replay: nav.replayParam } : {}),
}));

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  loadTossPayments: vi.fn().mockResolvedValue({
    widgets: () => ({
      setAmount: vi.fn(),
      renderPaymentMethods: vi.fn(),
      renderAgreement: vi.fn(),
      requestPayment: vi.fn(),
    }),
  }),
}));

import { HapcardReplayButton } from '@/components/hapcard/replay-button';

const DEFAULT_PROPS = { hapcardId: 'h1', mode: '친구합' };

beforeEach(() => {
  vi.clearAllMocks();
  nav.replayParam = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('HapcardReplayButton — trigger + dialog', () => {
  it('트리거 버튼이 i18n label로 렌더된다', () => {
    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /그럴리 없어! 다시/ })).toBeInTheDocument();
  });

  it('버튼 클릭 시 confirm dialog 4개 텍스트 노출, fetch 미호출', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /그럴리 없어! 다시/ }));

    expect(await screen.findByText('그럴리 없어! 다시 볼까요?')).toBeInTheDocument();
    expect(screen.getByText(/토큰 1개가 차감되며/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재해석 받기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('취소 클릭 시 dialog 닫힘, fetch 미호출', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /그럴리 없어! 다시/ }));
    await screen.findByText('그럴리 없어! 다시 볼까요?');

    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    await waitFor(() =>
      expect(screen.queryByText('그럴리 없어! 다시 볼까요?')).toBeNull(),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('HapcardReplayButton — mutation success', () => {
  it('재해석 받기 클릭 → POST 호출 + 성공 메시지 노출', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ hapcard_id: 'h1' }),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /그럴리 없어! 다시/ }));
    await screen.findByText('그럴리 없어! 다시 볼까요?');

    await userEvent.click(screen.getByRole('button', { name: '재해석 받기' }));

    await waitFor(() =>
      expect(screen.queryByText('재해석 완료. 흐름이 갱신되었어요.')).not.toBeNull(),
    );
  });
});

describe('HapcardReplayButton — error paths', () => {
  it('PAYMENT_REQUIRED(402) → 결제 시트 오픈', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'replay',
        ref: 'replay:h1:2026-06-02',
        amount_krw: 400,
      }),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /그럴리 없어! 다시/ }));
    await screen.findByText('그럴리 없어! 다시 볼까요?');
    await userEvent.click(screen.getByRole('button', { name: '재해석 받기' }));

    expect(await screen.findByTestId('feature-pay-sheet')).toBeInTheDocument();
  });

  it('INTERNAL_ERROR(500) → 에러 메시지 + 다시 시도 버튼으로 상태 reset', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'fail' } }),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /그럴리 없어! 다시/ }));
    await screen.findByText('그럴리 없어! 다시 볼까요?');
    await userEvent.click(screen.getByRole('button', { name: '재해석 받기' }));

    expect(await screen.findByText('잠시 문제가 생겼어요. 다시 시도해주세요.')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: '다시 시도' });

    await userEvent.click(retryBtn);
    expect(screen.getByRole('button', { name: '재해석 받기' })).not.toBeDisabled();
  });
});

describe('HapcardReplayButton — ?replay=1 결제 후 복귀', () => {
  it('replay=1 → 다이얼로그 자동 재오픈 + 재발화 1회 → 성공', async () => {
    nav.replayParam = '1';
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hapcard_id: 'h1' }),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);

    await waitFor(() =>
      expect(screen.queryByText('재해석 완료. 흐름이 갱신되었어요.')).not.toBeNull(),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/hapcards/h1/replay', { method: 'POST' });
  });
});
