// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardReplayButton } from '@/components/hapcard/replay-button';

const DEFAULT_PROPS = { hapcardId: 'h1', mode: '친구합' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('HapcardReplayButton — trigger + dialog', () => {
  it('트리거 버튼이 i18n label로 렌더된다', () => {
    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /다시합/ })).toBeInTheDocument();
  });

  it('버튼 클릭 시 confirm dialog 4개 텍스트 노출, fetch 미호출', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /다시합/ }));

    expect(await screen.findByText('다시합으로 재해석할까요?')).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /다시합/ }));
    await screen.findByText('다시합으로 재해석할까요?');

    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    await waitFor(() =>
      expect(screen.queryByText('다시합으로 재해석할까요?')).toBeNull(),
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
    await userEvent.click(screen.getByRole('button', { name: /다시합/ }));
    await screen.findByText('다시합으로 재해석할까요?');

    await userEvent.click(screen.getByRole('button', { name: '재해석 받기' }));

    await waitFor(() =>
      expect(screen.queryByText('재해석 완료. 흐름이 갱신되었어요.')).not.toBeNull(),
    );
  });
});

describe('HapcardReplayButton — error paths', () => {
  it('INSUFFICIENT_TOKENS(402) → 안내 메시지 + /me 링크, dialog 유지', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { code: 'INSUFFICIENT_TOKENS', message: 'no tokens' } }),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /다시합/ }));
    await screen.findByText('다시합으로 재해석할까요?');
    await userEvent.click(screen.getByRole('button', { name: '재해석 받기' }));

    expect(
      await screen.findByText('토큰이 부족합니다. 충전 후 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '충전하러 가기' })).toHaveAttribute('href', '/me');
    expect(screen.getByText('다시합으로 재해석할까요?')).toBeInTheDocument();
  });

  it('INTERNAL_ERROR(500) → 에러 메시지 + 다시 시도 버튼으로 상태 reset', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'fail' } }),
    } as Response);

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /다시합/ }));
    await screen.findByText('다시합으로 재해석할까요?');
    await userEvent.click(screen.getByRole('button', { name: '재해석 받기' }));

    expect(await screen.findByText('잠시 문제가 생겼어요. 다시 시도해주세요.')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: '다시 시도' });

    await userEvent.click(retryBtn);
    expect(screen.getByRole('button', { name: '재해석 받기' })).not.toBeDisabled();
  });
});
