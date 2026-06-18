import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@apps-in-toss/web-framework', () => ({
  getTossShareLink: vi.fn(),
  share: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
}));

import { getTossShareLink, share } from '@apps-in-toss/web-framework';
import { apiFetch } from '@/lib/api/client';
import { shareHapcard } from './toss-share';

const mockedGetLink = vi.mocked(getTossShareLink);
const mockedShare = vi.mocked(share);
const mockedApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shareHapcard', () => {
  it('share 라우트에서 받은 공개 OG URL 을 getTossShareLink 2번째 인자로 전달한다', async () => {
    mockedApiFetch.mockResolvedValue({
      og_image_url: 'https://todaychemi.vercel.app/api/og/share/tok',
    });
    mockedGetLink.mockResolvedValue('https://toss.link/abc');

    await shareHapcard('hap-1', 'tok-123');

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/hapcards/hap-1/share',
      expect.objectContaining({
        method: 'POST',
        token: 'tok-123',
        body: expect.objectContaining({ range: 'nickname-only', channel: 'web_share' }),
      }),
    );
    expect(mockedGetLink).toHaveBeenCalledWith(
      'intoss://todaychemi/hapcard/hap-1',
      'https://todaychemi.vercel.app/api/og/share/tok',
    );
    expect(mockedShare).toHaveBeenCalledWith({ message: 'https://toss.link/abc' });
  });

  it('share 라우트 실패 시 OG 없이 딥링크만 공유한다(폴백)', async () => {
    mockedApiFetch.mockRejectedValue(new Error('boom'));
    mockedGetLink.mockResolvedValue('https://toss.link/def');

    await shareHapcard('hap-2', 'tok-123');

    // OG 이미지 인자 없이 딥링크만 전달 — 공유가 OG 실패로 깨지지 않는다.
    expect(mockedGetLink).toHaveBeenCalledWith('intoss://todaychemi/hapcard/hap-2');
    expect(mockedShare).toHaveBeenCalledWith({ message: 'https://toss.link/def' });
  });
});
