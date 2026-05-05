// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';

vi.mock('@/lib/share/share-handler');

import { shareOrCopy } from '@/lib/share/share-handler';
import { HapcardShare } from '@/components/hapcard/share';

const MOCK_VISUALS = {
  user: {
    day_pillar: '甲戌',
    day_master_element: '목' as const,
    five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 } as Record<string, number>,
  },
  relation: {
    day_pillar: '辛未',
    day_master_element: '금' as const,
    five_elements_counts: { 목: 1, 화: 2, 토: 1, 금: 3, 수: 1 } as Record<string, number>,
  },
};

const SHARE_PROPS = {
  hapcardId: 'hap-uuid-001',
  mode: '친구합',
  nickname: '봄달',
  score: 78,
  genderNormalized: 'F' as const,
  visuals: MOCK_VISUALS,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(shareOrCopy).mockResolvedValue('shared');
});

describe('HapcardShare', () => {
  it('data-testid="hapcard-share" 렌더', () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    expect(document.querySelector('[data-testid="hapcard-share"]')).not.toBeNull();
  });

  it('"공유합카드 만들기" 버튼 표시', () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    expect(screen.getByRole('button', { name: '공유합카드 만들기' })).toBeInTheDocument();
  });

  it('버튼 클릭 → ShareSheet 열림 (별명만 라디오 표시)', async () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '공유합카드 만들기' }));
    await waitFor(() => expect(screen.getByLabelText('별명만')).toBeInTheDocument());
  });

  it('ShareSheet 공유하기 클릭 → shareOrCopy 호출', async () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '공유합카드 만들기' }));
    await waitFor(() => screen.getByRole('button', { name: '공유하기' }));
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));
    await waitFor(() => expect(shareOrCopy).toHaveBeenCalledOnce());
  });

  it('shareOrCopy "shared" → 성공 메시지 표시', async () => {
    vi.mocked(shareOrCopy).mockResolvedValue('shared');
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '공유합카드 만들기' }));
    await waitFor(() => screen.getByRole('button', { name: '공유하기' }));
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));
    await waitFor(() =>
      expect(screen.getByText(/공유했어요|링크를 복사했어요/)).toBeInTheDocument(),
    );
  });
});
