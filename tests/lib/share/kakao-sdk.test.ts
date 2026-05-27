// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = 'js-key';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete (window as typeof window & { Kakao?: unknown }).Kakao;
});

describe('shareToKakao', () => {
  it('initializes Kakao SDK and sends feed template with share_id callback arg', async () => {
    const init = vi.fn();
    const sendDefault = vi.fn();
    (window as typeof window & { Kakao?: unknown }).Kakao = {
      init,
      isInitialized: () => false,
      Share: { sendDefault },
    };

    const { shareToKakao } = await import('@/lib/share/kakao-sdk');
    await shareToKakao({
      share_id: '550e8400-e29b-41d4-a716-446655440001',
      title: '봄달님과의 친구 사이',
      text: '봄달님과의 오늘온도: 38.4°C · 오늘사이에서 확인해봐',
      url: 'https://hap.plae/h/share-token',
      og_image_url: 'https://hap.plae/api/og/share/share-token',
    });

    expect(init).toHaveBeenCalledWith('js-key');
    expect(sendDefault).toHaveBeenCalledWith(expect.objectContaining({
      objectType: 'feed',
      serverCallbackArgs: {
        share_id: '550e8400-e29b-41d4-a716-446655440001',
      },
    }));
  });
});
