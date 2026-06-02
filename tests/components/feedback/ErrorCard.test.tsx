// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { ErrorCard } from '@/components/feedback/ErrorCard';

describe('ErrorCard', () => {
  it('data-testid="error-card" 렌더', () => {
    renderWithProviders(<ErrorCard code="CALC_FAIL" />);
    expect(document.querySelector('[data-testid="error-card"]')).not.toBeNull();
  });

  it('CALC_FAIL 카피 표시', () => {
    renderWithProviders(<ErrorCard code="CALC_FAIL" />);
    expect(
      screen.getByText('사주 계산에 실패했어요. 생년월일시를 한 번 더 확인해주세요.'),
    ).toBeInTheDocument();
  });

  it('LLM_TIMEOUT 카피 표시', () => {
    renderWithProviders(<ErrorCard code="LLM_TIMEOUT" />);
    expect(
      screen.getByText('AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('LLM_RATE_LIMIT 카피 표시', () => {
    renderWithProviders(<ErrorCard code="LLM_RATE_LIMIT" />);
    expect(
      screen.getByText('지금 이용자가 많아요. 1~2분 뒤 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('USER_QUOTA_EXCEEDED 카피 표시', () => {
    renderWithProviders(<ErrorCard code="USER_QUOTA_EXCEEDED" />);
    expect(
      screen.getByText('오늘의 질문 한도를 다 쓰셨어요. 내일 자정에 초기화됩니다.'),
    ).toBeInTheDocument();
  });

  it('IP_RATE_LIMIT 카피 표시', () => {
    renderWithProviders(<ErrorCard code="IP_RATE_LIMIT" />);
    expect(
      screen.getByText('너무 자주 시도하고 있어요. 1분 후 다시 해주세요.'),
    ).toBeInTheDocument();
  });

  it('NETWORK_OFFLINE 카피 표시', () => {
    renderWithProviders(<ErrorCard code="NETWORK_OFFLINE" />);
    expect(
      screen.getByText('인터넷 연결이 끊어졌어요. 마지막 결과는 확인할 수 있어요.'),
    ).toBeInTheDocument();
  });

  it('onRetry 있으면 [다시 시도] 버튼 표시', () => {
    renderWithProviders(<ErrorCard code="CALC_FAIL" onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('onRetry 없으면 [다시 시도] 버튼 숨김', () => {
    renderWithProviders(<ErrorCard code="LLM_TIMEOUT" />);
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
  });

  it('[다시 시도] 클릭 → onRetry 호출', () => {
    const onRetry = vi.fn();
    renderWithProviders(<ErrorCard code="CALC_FAIL" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('onReport 있으면 [제보] 버튼 표시', () => {
    renderWithProviders(<ErrorCard code="LLM_TIMEOUT" onReport={vi.fn()} />);
    expect(screen.getByRole('button', { name: '제보' })).toBeInTheDocument();
  });

  it('INSUFFICIENT_TOKENS → 충전 링크 없음 (ADR-039: 인뷰 결제 시트로 전환)', () => {
    renderWithProviders(<ErrorCard code="INSUFFICIENT_TOKENS" />);
    expect(screen.queryByRole('link', { name: '충전하러 가기' })).toBeNull();
  });

  it('CTA 미정의 코드(CALC_FAIL) → 링크 미표시', () => {
    renderWithProviders(<ErrorCard code="CALC_FAIL" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('INSUFFICIENT_TOKENS — 카피만 표시(정적 링크 없음)', () => {
    renderWithProviders(<ErrorCard code="INSUFFICIENT_TOKENS" />);
    expect(screen.getByText('포인트가 부족해요. 충전 후 다시 시도해주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
