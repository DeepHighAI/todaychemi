// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardRoleAnalysis } from '@/components/hapcard/role-analysis';

const ANALYSIS = {
  title: '무신 ↔ 갑인 관계 유지',
  summary: '상대는 나에게 편관으로 작동하고 나는 상대에게 편재로 작동합니다.',
  roles: [
    {
      title: '상대가 나에게',
      sipsin: '편관',
      body: '도전과 압박으로 방향을 다듬게 하는 역할로 느껴지기 쉬워요.',
    },
    {
      title: '내가 상대에게',
      sipsin: '편재',
      body: '기회와 확장을 열어주는 자원으로 보이기 쉬워요.',
    },
  ],
  areas: [
    { title: '수익 만들기', body: '기회 탐색과 실행을 누가 맡을지 먼저 나누면 좋아요.' },
    { title: '분배 기준', body: '수익·손실·재투자 기준을 숫자로 정해야 오해가 줄어듭니다.' },
    { title: '보관과 리스크', body: '장기 보관, 단기 실행, 리스크 검토를 역할별로 분리하세요.' },
  ],
  basis: ['본인 일주 무신', '인연 일주 갑인', '나에게 상대 편관', '상대에게 나 편재'],
  tip: '기회 탐색, 실행, 보관 역할을 나누고 분배 기준은 숫자로 남겨두세요.',
};

describe('HapcardRoleAnalysis', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('저장된 관계 유지 분석을 렌더한다', () => {
    renderWithProviders(<HapcardRoleAnalysis hapcardId="hapcard-1" analysis={ANALYSIS} />);

    expect(screen.getByTestId('hapcard-role-analysis')).toBeInTheDocument();
    expect(screen.getByText('무신 ↔ 갑인 관계 유지')).toBeInTheDocument();
    expect(screen.getByText('상대가 나에게')).toBeInTheDocument();
    expect(screen.getByText('편관')).toBeInTheDocument();
    expect(screen.getByText('수익 만들기')).toBeInTheDocument();
    expect(screen.getByText('본인 일주 무신')).toBeInTheDocument();
  });

  it('hapcardId로 관계 유지 API를 호출해 표시한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ analysis: ANALYSIS }), { status: 200 }),
    );

    renderWithProviders(<HapcardRoleAnalysis hapcardId="hapcard-1" />);

    expect(await screen.findByText('무신 ↔ 갑인 관계 유지')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/hapcards/hapcard-1/role-analysis');
  });
});
