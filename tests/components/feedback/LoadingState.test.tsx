// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { LoadingState } from '@/components/feedback/LoadingState';

describe('LoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('data-testid="loading-state" 렌더', () => {
    renderWithProviders(<LoadingState />);
    expect(document.querySelector('[data-testid="loading-state"]')).not.toBeNull();
  });

  it('초기 phase: 스켈레톤 표시 (data-testid="loading-skeleton")', () => {
    renderWithProviders(<LoadingState />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).not.toBeNull();
  });

  it('10초 후: "조금 더 걸리고 있어요" 보조 문구 표시', () => {
    renderWithProviders(<LoadingState />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('조금 더 걸리고 있어요')).toBeInTheDocument();
  });

  it('20초 후: data-testid="loading-timeout-card" 표시', () => {
    renderWithProviders(<LoadingState />);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(document.querySelector('[data-testid="loading-timeout-card"]')).not.toBeNull();
  });

  it('20초 후: LLM_TIMEOUT 에러 카피 표시', () => {
    renderWithProviders(<LoadingState />);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(
      screen.getByText('AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('20초 후 onTimeout 있으면 호출됨', () => {
    const onTimeout = vi.fn();
    renderWithProviders(<LoadingState onTimeout={onTimeout} />);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});
