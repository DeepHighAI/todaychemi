// @vitest-environment jsdom

import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HapcardLoadingState } from '@/components/hapcard/loading-state';
import { renderWithProviders } from '../../utils/render-with-providers';

describe('HapcardLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('초기 로딩 타이틀과 예상 소요 시간을 보여준다', () => {
    renderWithProviders(<HapcardLoadingState />);

    expect(screen.getByTestId('hapcard-loading-state')).toBeInTheDocument();
    expect(screen.getByText('두 사람의 흐름을 분석하고 있어요')).toBeInTheDocument();
    expect(screen.getByTestId('hapcard-loading-estimate')).toHaveTextContent('보통 20~40초 정도 걸려요');
    expect(screen.getByTestId('hapcard-loading-status')).toHaveTextContent('사주 구조를 정리하는 중');
    expect(screen.queryByText(/\d+%/)).toBeNull();
  });

  it('10초 후 끌림과 긴장의 균형 상태로 바뀐다', () => {
    renderWithProviders(<HapcardLoadingState />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId('hapcard-loading-status')).toHaveTextContent('끌림과 긴장의 균형을 살피는 중');
    expect(screen.getByTestId('hapcard-loading-note')).toHaveTextContent(
      '강한 끌림도 천천히 확인하면 더 자연스럽게 이어져요.',
    );
  });

  it('25초 후 문장 다듬기 상태와 안심 문구를 보여준다', () => {
    renderWithProviders(<HapcardLoadingState />);

    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    expect(screen.getByTestId('hapcard-loading-status')).toHaveTextContent('관계 해석 문장을 다듬는 중');
    expect(screen.getByTestId('hapcard-loading-status')).toHaveTextContent(
      '결과가 어색하지 않도록 쉬운 말로 정리하고 있어요.',
    );
  });

  it('45초 이후 장기 대기 상태를 별도로 보여주고 timeout 카드처럼 보이지 않는다', () => {
    renderWithProviders(<HapcardLoadingState />);

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.getByTestId('hapcard-loading-long-wait')).toHaveTextContent(
      '분석량이 많아 조금 더 걸리고 있어요',
    );
    expect(screen.getByTestId('hapcard-loading-status')).toHaveTextContent(
      '조금만 더 기다려 주세요. 분석은 계속 진행 중이에요.',
    );
    expect(screen.queryByTestId('loading-timeout-card')).toBeNull();
  });
});
