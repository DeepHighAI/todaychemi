// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';

vi.mock('@/lib/share/share-handler', () => ({
  copyShareLink: vi.fn(),
  shareCardOrDownload: vi.fn(),
}));

vi.mock('@/lib/share/kakao-sdk', () => ({
  shareToKakao: vi.fn(),
}));

import { shareToKakao } from '@/lib/share/kakao-sdk';
import { copyShareLink, shareCardOrDownload } from '@/lib/share/share-handler';
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

const CREATE_RESPONSE = {
  ok: true,
  share_id: '550e8400-e29b-41d4-a716-446655440001',
  url: 'https://hap.plae/h/share-token',
  og_image_url: 'https://hap.plae/api/og/share/share-token',
  title: '봄달님과의 친구 사이',
  text: '봄달님과의 오늘온도: 38.4°C · 오늘사이에서 확인해봐',
  expires_at: '2026-06-23T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(copyShareLink).mockResolvedValue('copied');
  vi.mocked(shareCardOrDownload).mockResolvedValue('shared');
  vi.mocked(shareToKakao).mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    return Promise.resolve(new Response(JSON.stringify(CREATE_RESPONSE), { status: 200 }));
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HapcardShare', () => {
  it('data-testid="hapcard-share" 렌더', () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    expect(document.querySelector('[data-testid="hapcard-share"]')).not.toBeNull();
  });

  it('"오늘 우리는 공유하기" 버튼 표시', () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    expect(screen.getByRole('button', { name: '오늘 우리는 공유하기' })).toBeInTheDocument();
  });

  it('버튼 클릭 → ShareSheet 열림 (카카오톡 버튼 표시)', async () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '오늘 우리는 공유하기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '카카오톡' })).toBeInTheDocument());
  });

  it('링크 복사 클릭 → share token 생성 후 copyShareLink 호출, 보상 API 미호출', async () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '오늘 우리는 공유하기' }));
    await waitFor(() => screen.getByRole('button', { name: '링크 복사' }));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));

    await waitFor(() => expect(copyShareLink).toHaveBeenCalledOnce());
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/hapcards/hap-uuid-001/share',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ range: 'nickname-only', channel: 'copy_link' }),
      }),
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith('/api/share/complete', expect.anything());
    await screen.findByText('링크를 복사했어요!');
  });

  it('인스타그램/카드 공유 성공 → 보상 API 없이 공유 완료 메시지 표시', async () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '오늘 우리는 공유하기' }));
    await waitFor(() => screen.getByRole('button', { name: '인스타그램/카드' }));
    fireEvent.click(screen.getByRole('button', { name: '인스타그램/카드' }));

    await waitFor(() => expect(shareCardOrDownload).toHaveBeenCalledOnce());
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith('/api/share/complete', expect.anything());
    await screen.findByText('공유했어요!');
  });

  it('카카오톡 클릭 → Kakao SDK 호출, client complete API는 호출하지 않음', async () => {
    renderWithProviders(<HapcardShare {...SHARE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '오늘 우리는 공유하기' }));
    await waitFor(() => screen.getByRole('button', { name: '카카오톡' }));
    fireEvent.click(screen.getByRole('button', { name: '카카오톡' }));

    await waitFor(() => expect(shareToKakao).toHaveBeenCalledOnce());
    expect(shareToKakao).toHaveBeenCalledWith(expect.objectContaining({ share_id: CREATE_RESPONSE.share_id }));
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith('/api/share/complete', expect.anything());
    await screen.findByText('카카오톡 공유창을 열었어요.');
  });
});
