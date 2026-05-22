import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharePayload } from '@/lib/share/build-share-payload';

const MOCK_PAYLOAD: SharePayload = {
  title: '봄달님과의 친구 사이',
  text: '봄달님과의 오늘온도: 38.4°C · 오늘사이에서 확인해봐',
  url: 'https://hap.plae/h/hap-uuid-001?mode=친구합',
};

describe('shareOrCopy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigator.share 존재 시 navigator.share(payload) 호출 → "shared" 반환', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

    const { shareOrCopy } = await import('@/lib/share/share-handler');
    const result = await shareOrCopy(MOCK_PAYLOAD);

    expect(shareMock).toHaveBeenCalledWith({
      title: MOCK_PAYLOAD.title,
      text: MOCK_PAYLOAD.text,
      url: MOCK_PAYLOAD.url,
    });
    expect(result).toBe('shared');
  });

  it('navigator.share 부재 시 clipboard.writeText 호출 → "copied" 반환', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const { shareOrCopy } = await import('@/lib/share/share-handler');
    const result = await shareOrCopy(MOCK_PAYLOAD);

    expect(writeTextMock).toHaveBeenCalledWith(
      `${MOCK_PAYLOAD.text}\n${MOCK_PAYLOAD.url}`,
    );
    expect(result).toBe('copied');
  });

  it('navigator.share AbortError(사용자 취소) → "aborted" 반환, throw 없음', async () => {
    const abortError = new DOMException('User aborted', 'AbortError');
    const shareMock = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

    const { shareOrCopy } = await import('@/lib/share/share-handler');
    const result = await shareOrCopy(MOCK_PAYLOAD);

    expect(result).toBe('aborted');
  });

  it('navigator.share, clipboard 둘 다 실패 시 throw', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const { shareOrCopy } = await import('@/lib/share/share-handler');
    await expect(shareOrCopy(MOCK_PAYLOAD)).rejects.toThrow('Clipboard denied');
  });
});
