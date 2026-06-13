// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardChangeIndicator } from '@/components/hapcard/change-indicator';
import type { HapcardChangeResponse } from '@/types/hapcard';

const HAPCARD_ID = 'h1';

const COMPARABLE_UP: HapcardChangeResponse = {
  status: 'comparable',
  delta: 5,
  factors: [
    { factor: 'hap_chung_hyung_hae', delta: 4 },
    { factor: 'sipsin', delta: -2 },
    { factor: 'yunse_adjustment', delta: 1 },
  ],
};

const COMPARABLE_DOWN: HapcardChangeResponse = {
  status: 'comparable',
  delta: -8,
  factors: [{ factor: 'ohaeng', delta: -6 }],
};

const FIRST: HapcardChangeResponse = { status: 'first', delta: null, factors: [] };
const VERSION_CHANGED: HapcardChangeResponse = { status: 'version_changed', delta: null, factors: [] };

function mockFetchOk(data: HapcardChangeResponse) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('HapcardChangeIndicator — loading', () => {
  it('fetch 진행 중 → skeleton', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<HapcardChangeIndicator hapcardId={HAPCARD_ID} />);
    expect(await screen.findByTestId('hapcard-change-skeleton')).toBeInTheDocument();
  });
});

describe('HapcardChangeIndicator — comparable', () => {
  it('상승 → 메인 변화 + 쉬운말 요인 라벨 + 부호 (둘 사이 작용 +4)', async () => {
    mockFetchOk(COMPARABLE_UP);
    renderWithProviders(<HapcardChangeIndicator hapcardId={HAPCARD_ID} />);

    await waitFor(() => expect(screen.getByTestId('hapcard-change')).toBeInTheDocument());

    // 메인 델타: 상승 표기
    expect(screen.getByTestId('hapcard-change-delta')).toHaveTextContent('올랐어요');

    // 요인: 쉬운말 라벨 + 부호 있는 원점수
    const factors = screen.getAllByTestId('hapcard-change-factor');
    expect(factors).toHaveLength(3);
    expect(factors[0]).toHaveTextContent('둘 사이 작용');
    expect(factors[0]).toHaveTextContent('+4');
    expect(factors[1]).toHaveTextContent('역할 관계');
    expect(factors[1]).toHaveTextContent('-2');
    expect(factors[2]).toHaveTextContent('운의 흐름');
    expect(factors[2]).toHaveTextContent('+1');
  });

  it('하락 → 메인 변화 내림 표기 + 단일 요인', async () => {
    mockFetchOk(COMPARABLE_DOWN);
    renderWithProviders(<HapcardChangeIndicator hapcardId={HAPCARD_ID} />);

    await waitFor(() => expect(screen.getByTestId('hapcard-change')).toBeInTheDocument());
    expect(screen.getByTestId('hapcard-change-delta')).toHaveTextContent('내렸어요');
    expect(screen.getByTestId('hapcard-change-factor')).toHaveTextContent('기운 균형');
  });
});

describe('HapcardChangeIndicator — 안내 문구 (비교 불가)', () => {
  it('first → "이번이 첫 해석이에요" + 요인·델타 없음', async () => {
    mockFetchOk(FIRST);
    renderWithProviders(<HapcardChangeIndicator hapcardId={HAPCARD_ID} />);

    await waitFor(() => expect(screen.getByTestId('hapcard-change')).toBeInTheDocument());
    expect(screen.getByText('이번이 첫 해석이에요')).toBeInTheDocument();
    expect(screen.queryByTestId('hapcard-change-delta')).toBeNull();
    expect(screen.queryByTestId('hapcard-change-factor')).toBeNull();
  });

  it('version_changed → 점수 기준 업데이트 안내', async () => {
    mockFetchOk(VERSION_CHANGED);
    renderWithProviders(<HapcardChangeIndicator hapcardId={HAPCARD_ID} />);

    await waitFor(() => expect(screen.getByTestId('hapcard-change')).toBeInTheDocument());
    expect(
      screen.getByText('점수 기준이 업데이트됐어요 — 이전 해석과 직접 비교는 어려워요'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('hapcard-change-factor')).toBeNull();
  });
});

describe('HapcardChangeIndicator — error', () => {
  it('fetch 실패 → role="alert"', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<HapcardChangeIndicator hapcardId={HAPCARD_ID} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
