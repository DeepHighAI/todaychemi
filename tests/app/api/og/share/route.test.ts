import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/share/public-share');

const imageResponseSpy = vi.fn();

vi.mock('next/og', () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(...args: unknown[]) {
      imageResponseSpy(...args);
      super('fake-png', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    }
  },
}));

import { buildPublicShareOgPayload, getPublicShareByToken } from '@/lib/share/public-share';
import { GET } from '@/app/api/og/share/[token]/route';

const PUBLIC_SHARE = {
  share_id: '550e8400-e29b-41d4-a716-446655440001',
  user_id: '550e8400-e29b-41d4-a716-446655440099',
  hapcard_id: '550e8400-e29b-41d4-a716-446655440000',
  relation_id: '550e8400-e29b-41d4-a716-446655440088',
  range: 'nickname-only',
  title: '봄달님과의 친구 관계',
  text: '봄달님과의 케미온도: 38.4°C · 오늘케미에서 확인해봐',
  url: 'https://hap.plae/h/share-token',
  og_image_url: 'https://hap.plae/api/og/share/share-token',
  mode: '친구합',
  compat_score: 78,
  nickname: '봄달',
  gender_normalized: 'F',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPublicShareByToken).mockResolvedValue(PUBLIC_SHARE as never);
  vi.mocked(buildPublicShareOgPayload).mockReturnValue({
    nickname: '봄달',
    temperature_label: '38.4°C',
    mode: '친구합',
    range: 'nickname-only',
  } as never);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(new ArrayBuffer(8))),
  );
});

describe('GET /api/og/share/[token]', () => {
  it('200 image/png — public share OG card', async () => {
    const res = await GET(new Request('https://hap.plae/api/og/share/share-token'), {
      params: Promise.resolve({ token: 'share-token' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(getPublicShareByToken).toHaveBeenCalledWith('share-token');
    expect(imageResponseSpy).toHaveBeenCalledOnce();
  });

  it('404 when token is invalid or expired', async () => {
    vi.mocked(getPublicShareByToken).mockResolvedValue(null);

    const res = await GET(new Request('https://hap.plae/api/og/share/missing'), {
      params: Promise.resolve({ token: 'missing' }),
    });

    expect(res.status).toBe(404);
    expect(imageResponseSpy).not.toHaveBeenCalled();
  });

  it('does not pass raw PII fields to OG payload builder', async () => {
    await GET(new Request('https://hap.plae/api/og/share/share-token'), {
      params: Promise.resolve({ token: 'share-token' }),
    });

    const shareArg = vi.mocked(buildPublicShareOgPayload).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(Object.keys(shareArg)).not.toContain('birth_date');
    expect(Object.keys(shareArg)).not.toContain('name');
    expect(Object.keys(shareArg)).not.toContain('email');
    expect(Object.keys(shareArg)).not.toContain('birth_place');
    expect(Object.keys(shareArg)).not.toContain('gender');
  });

  it('render catch 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(getPublicShareByToken).mockRejectedValue(
      new Error('public share failed birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET(new Request('https://hap.plae/api/og/share/share-token'), {
      params: Promise.resolve({ token: 'share-token' }),
    });

    expect(res.status).toBe(500);
    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });
});
